/**
 * Passkeys als zweiter Faktor oder allein (passwortlos, mit Gerätesperre)
 * (WebAuthn, @simplewebauthn/server).
 * RP-ID ist der Hostname aus ORIGIN; die Challenge liegt bei der halbfertigen Anmeldung.
 */
import {
	generateAuthenticationOptions,
	generateRegistrationOptions,
	verifyAuthenticationResponse,
	verifyRegistrationResponse,
	type AuthenticationResponseJSON,
	type RegistrationResponseJSON
} from '@simplewebauthn/server';
import { and, eq } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { passkeys, persons } from '../db/schema.ts';
import { resetFailures, secondFactorWait, updatePending, type Pending } from './local.ts';

function rp(origin: string) {
	return { origin, rpID: new URL(origin).hostname };
}

export async function registrationOptions(
	pending: Pending,
	person: { id: string; email: string; displayName: string },
	origin: string
) {
	const existing = await db
		.select({ id: passkeys.id, transports: passkeys.transports })
		.from(passkeys)
		.where(eq(passkeys.personId, person.id));
	const options = await generateRegistrationOptions({
		rpName: 'Intranet',
		rpID: rp(origin).rpID,
		userName: person.email,
		userDisplayName: person.displayName,
		userID: new TextEncoder().encode(person.id),
		attestationType: 'none',
		excludeCredentials: existing.map((c) => ({ id: c.id, transports: c.transports ?? undefined })),
		authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' }
	});
	await updatePending(pending.id, { challenge: options.challenge });
	return options;
}

export async function verifyRegistration(
	pending: Pending,
	response: RegistrationResponseJSON,
	origin: string,
	name: string
): Promise<boolean> {
	if (!pending.challenge) return false;
	await updatePending(pending.id, { challenge: null });
	const { rpID } = rp(origin);
	try {
		const result = await verifyRegistrationResponse({
			response,
			expectedChallenge: pending.challenge,
			expectedOrigin: origin,
			expectedRPID: rpID
		});
		if (!result.verified) return false;
		const { credential } = result.registrationInfo;
		await db.insert(passkeys).values({
			id: credential.id,
			personId: pending.personId,
			publicKey: credential.publicKey,
			counter: credential.counter,
			transports: credential.transports ?? null,
			name: name.trim().slice(0, 60) || 'Passkey'
		});
		return true;
	} catch (err) {
		console.error('Passkey-Registrierung abgelehnt:', err);
		return false;
	}
}

export async function authenticationOptions(pending: Pending, origin: string) {
	const creds = await db
		.select({ id: passkeys.id, transports: passkeys.transports })
		.from(passkeys)
		.where(eq(passkeys.personId, pending.personId));
	const options = await generateAuthenticationOptions({
		rpID: rp(origin).rpID,
		allowCredentials: creds.map((c) => ({ id: c.id, transports: c.transports ?? undefined })),
		userVerification: 'preferred'
	});
	await updatePending(pending.id, { challenge: options.challenge });
	return options;
}

export async function verifyAuthentication(
	pending: Pending,
	response: AuthenticationResponseJSON,
	origin: string
): Promise<boolean> {
	if (!pending.challenge) return false;
	await updatePending(pending.id, { challenge: null });
	const [cred] = await db
		.select()
		.from(passkeys)
		.where(and(eq(passkeys.id, response.id), eq(passkeys.personId, pending.personId)));
	if (!cred) return false;
	try {
		const result = await verifyAuthenticationResponse({
			response,
			expectedChallenge: pending.challenge,
			expectedOrigin: origin,
			expectedRPID: rp(origin).rpID,
			credential: {
				id: cred.id,
				publicKey: cred.publicKey,
				counter: cred.counter,
				transports: cred.transports ?? undefined
			}
		});
		if (!result.verified) return false;
		await db
			.update(passkeys)
			.set({ counter: result.authenticationInfo.newCounter, lastUsedAt: new Date() })
			.where(eq(passkeys.id, cred.id));
		await resetFailures(pending.personId);
		return true;
	} catch (err) {
		console.error('Passkey-Anmeldung abgelehnt:', err);
		return false;
	}
}

export async function hasPasskeys(personId: string): Promise<boolean> {
	const rows = await db
		.select({ id: passkeys.id })
		.from(passkeys)
		.where(eq(passkeys.personId, personId))
		.limit(1);
	return rows.length > 0;
}

// ---------------------------------------------------------------------------
// Anmeldung nur mit Passkey (ohne Passwort)
// ---------------------------------------------------------------------------

/**
 * Optionen für die passwortlose Anmeldung: Der Browser bietet alle Passkeys
 * dieser Seite an (auffindbare Zugangsdaten); Gerätesperre ist Pflicht.
 */
export async function directOptions(origin: string) {
	return generateAuthenticationOptions({
		rpID: rp(origin).rpID,
		allowCredentials: [],
		userVerification: 'required'
	});
}

/**
 * Prüft eine passwortlose Anmeldung. Gibt die Person zurück oder einen Grund.
 * Nur aktive lokale Konten; die Sperre nach Fehlversuchen gilt wie beim
 * zweiten Faktor.
 */
export async function verifyDirect(
	response: AuthenticationResponseJSON,
	challenge: string,
	origin: string
): Promise<{ ok: true; personId: string } | { ok: false; warten?: number }> {
	if (!response || typeof response.id !== 'string') return { ok: false };
	const [cred] = await db
		.select({
			id: passkeys.id,
			personId: passkeys.personId,
			publicKey: passkeys.publicKey,
			counter: passkeys.counter,
			transports: passkeys.transports,
			status: persons.status,
			authSource: persons.authSource
		})
		.from(passkeys)
		.innerJoin(persons, eq(persons.id, passkeys.personId))
		.where(eq(passkeys.id, response.id));
	if (!cred || cred.authSource !== 'local' || cred.status !== 'active') return { ok: false };
	const warten = await secondFactorWait(cred.personId);
	if (warten > 0) return { ok: false, warten };
	try {
		const result = await verifyAuthenticationResponse({
			response,
			expectedChallenge: challenge,
			expectedOrigin: origin,
			expectedRPID: rp(origin).rpID,
			requireUserVerification: true,
			credential: {
				id: cred.id,
				publicKey: cred.publicKey,
				counter: cred.counter,
				transports: cred.transports ?? undefined
			}
		});
		if (!result.verified) return { ok: false };
		await db
			.update(passkeys)
			.set({ counter: result.authenticationInfo.newCounter, lastUsedAt: new Date() })
			.where(eq(passkeys.id, cred.id));
		await resetFailures(cred.personId);
		return { ok: true, personId: cred.personId };
	} catch (err) {
		console.error('Passwortlose Passkey-Anmeldung abgelehnt:', err);
		return { ok: false };
	}
}
