/**
 * Erneute Anmeldung vor kritischen Verwaltungsaktionen (ASVS V3.7.1):
 * Rollen vergeben und entziehen, Personen sperren und freigeben, Anmeldung und
 * Entra einstellen, SMTP. Eine Bestätigung gilt 10 Minuten für diese Sitzung.
 *
 * Bestätigen: lokale Konten mit dem zweiten Faktor (Code aus der App,
 * Wiederherstellungscode oder Passkey), Microsoft-Konten mit einer neuen
 * Microsoft-Anmeldung. In der Teams-App nicht möglich (Weiterleitung im Rahmen),
 * dort gibt es einen Link in den Browser.
 */
import { fail } from '@sveltejs/kit';
import {
	generateAuthenticationOptions,
	verifyAuthenticationResponse,
	type AuthenticationResponseJSON
} from '@simplewebauthn/server';
import { and, eq } from 'drizzle-orm';
import type { BestaetigungsWege } from '../../bestaetigung.ts';
import { audit } from '../audit.ts';
import { db } from '../db/index.ts';
import { localCredentials, passkeys, persons, sessions } from '../db/schema.ts';
import { resetFailures, secondFactorWait, useRecoveryCode, verifyTotpForPerson } from './local.ts';

export const BESTAETIGUNG_MS = 10 * 60_000;

export type Bestaetigungsart = 'totp' | 'code' | 'passkey' | 'entra';

/** Bis wann die Bestätigung gilt, sonst null */
export function bestaetigtBis(locals: App.Locals, jetzt = Date.now()): Date | null {
	const at = locals.session?.confirmedAt;
	if (!at) return null;
	const bis = at.getTime() + BESTAETIGUNG_MS;
	return bis > jetzt ? new Date(bis) : null;
}

/**
 * Für Formular-Aktionen: ohne gültige Bestätigung eine Ablehnung, die die
 * Oberfläche erkennt (`bestaetigung: true`) und den Dialog zum Bestätigen öffnet.
 */
export function bestaetigungFehlt(locals: App.Locals) {
	if (bestaetigtBis(locals)) return null;
	return fail(403, {
		bestaetigung: true as const,
		fehler: 'Bitte bestätige zuerst deine Anmeldung. Danach kannst du 10 Minuten lang ändern.'
	});
}

/** Wie die Person bestätigen kann */
export async function bestaetigungsWege(locals: App.Locals): Promise<BestaetigungsWege | null> {
	const p = locals.person;
	const s = locals.session;
	if (!p || !s) return null;
	if (s.authMethod === 'entra') return { art: 'entra', teams: locals.teams };
	const [cred] = await db
		.select({ totp: localCredentials.totpConfirmedAt })
		.from(localCredentials)
		.where(eq(localCredentials.personId, p.id));
	const [pk] = await db
		.select({ id: passkeys.id })
		.from(passkeys)
		.where(eq(passkeys.personId, p.id))
		.limit(1);
	return { art: 'lokal', totp: Boolean(cred?.totp), passkey: Boolean(pk), teams: false };
}

async function merken(
	sessionId: string,
	personId: string,
	art: Bestaetigungsart,
	ip: string
): Promise<Date> {
	const jetzt = new Date();
	await db.update(sessions).set({ confirmedAt: jetzt }).where(eq(sessions.id, sessionId));
	const [p] = await db
		.select({ tenantId: persons.tenantId })
		.from(persons)
		.where(eq(persons.id, personId));
	await audit({
		category: 'security',
		action: 'reauth.success',
		actorId: personId,
		tenantId: p?.tenantId,
		details: { art },
		ip
	});
	return new Date(jetzt.getTime() + BESTAETIGUNG_MS);
}

async function fehlversuch(personId: string, art: Bestaetigungsart, ip: string) {
	await audit({
		category: 'security',
		action: 'reauth.failed',
		actorId: personId,
		details: { art },
		ip
	});
}

export type BestaetigungsErgebnis =
	| { ok: true; bis: Date }
	| { ok: false; grund: 'falsch' | 'nicht_moeglich' }
	| { ok: false; grund: 'warten'; sekunden: number };

/** Lokales Konto: Code aus der Authenticator-App oder Wiederherstellungscode */
export async function mitCodeBestaetigen(
	locals: App.Locals,
	eingabe: string,
	ip: string
): Promise<BestaetigungsErgebnis> {
	const p = locals.person;
	const s = locals.session;
	if (!p || !s || s.authMethod !== 'local' || locals.teams)
		return { ok: false, grund: 'nicht_moeglich' };
	const wait = await secondFactorWait(p.id);
	if (wait > 0) return { ok: false, grund: 'warten', sekunden: wait };
	const code = eingabe.replace(/\s+/g, '');
	const art: Bestaetigungsart = /^\d{6}$/.test(code) ? 'totp' : 'code';
	const ok =
		art === 'totp' ? await verifyTotpForPerson(p.id, code) : await useRecoveryCode(p.id, code);
	if (!ok) {
		await fehlversuch(p.id, art, ip);
		return { ok: false, grund: 'falsch' };
	}
	return { ok: true, bis: await merken(s.id, p.id, art, ip) };
}

// ---------------------------------------------------------------------------
// Passkey: Challenge im Speicher, je Sitzung, einmalig, 5 Minuten
// ---------------------------------------------------------------------------

const CHALLENGE_MS = 5 * 60_000;
const offen = new Map<string, { challenge: string; bis: number }>();

function rp(origin: string) {
	return { origin, rpID: new URL(origin).hostname };
}

export async function passkeyOptionen(locals: App.Locals, origin: string) {
	const p = locals.person;
	const s = locals.session;
	if (!p || !s || s.authMethod !== 'local' || locals.teams) return null;
	const creds = await db
		.select({ id: passkeys.id, transports: passkeys.transports })
		.from(passkeys)
		.where(eq(passkeys.personId, p.id));
	if (creds.length === 0) return null;
	const options = await generateAuthenticationOptions({
		rpID: rp(origin).rpID,
		allowCredentials: creds.map((c) => ({ id: c.id, transports: c.transports ?? undefined })),
		userVerification: 'preferred'
	});
	const jetzt = Date.now();
	for (const [k, v] of offen) if (v.bis < jetzt) offen.delete(k);
	offen.set(s.id, { challenge: options.challenge, bis: jetzt + CHALLENGE_MS });
	return options;
}

export async function mitPasskeyBestaetigen(
	locals: App.Locals,
	antwort: AuthenticationResponseJSON,
	origin: string,
	ip: string
): Promise<BestaetigungsErgebnis> {
	const p = locals.person;
	const s = locals.session;
	if (!p || !s || s.authMethod !== 'local' || locals.teams)
		return { ok: false, grund: 'nicht_moeglich' };
	const e = offen.get(s.id);
	offen.delete(s.id);
	if (!e || e.bis < Date.now() || typeof antwort?.id !== 'string')
		return { ok: false, grund: 'falsch' };
	const wait = await secondFactorWait(p.id);
	if (wait > 0) return { ok: false, grund: 'warten', sekunden: wait };
	const [cred] = await db
		.select()
		.from(passkeys)
		.where(and(eq(passkeys.id, antwort.id), eq(passkeys.personId, p.id)));
	if (!cred) {
		await fehlversuch(p.id, 'passkey', ip);
		return { ok: false, grund: 'falsch' };
	}
	try {
		const result = await verifyAuthenticationResponse({
			response: antwort,
			expectedChallenge: e.challenge,
			expectedOrigin: origin,
			expectedRPID: rp(origin).rpID,
			credential: {
				id: cred.id,
				publicKey: cred.publicKey,
				counter: cred.counter,
				transports: cred.transports ?? undefined
			}
		});
		if (!result.verified) throw new Error('nicht bestätigt');
		await db
			.update(passkeys)
			.set({ counter: result.authenticationInfo.newCounter, lastUsedAt: new Date() })
			.where(eq(passkeys.id, cred.id));
	} catch (err) {
		console.error('Passkey-Bestätigung abgelehnt:', err);
		await fehlversuch(p.id, 'passkey', ip);
		return { ok: false, grund: 'falsch' };
	}
	await resetFailures(p.id);
	return { ok: true, bis: await merken(s.id, p.id, 'passkey', ip) };
}

/**
 * Microsoft-Konto: nach der erneuten Anmeldung (Rückkehr von Microsoft).
 * Gilt nur, wenn dieselbe Person sich angemeldet hat.
 */
export async function mitEntraBestaetigen(
	sessionId: string,
	oid: string,
	ip: string
): Promise<boolean> {
	const [row] = await db
		.select({ personId: sessions.personId, authMethod: sessions.authMethod, oid: persons.entraOid })
		.from(sessions)
		.innerJoin(persons, eq(persons.id, sessions.personId))
		.where(eq(sessions.id, sessionId));
	if (!row || row.authMethod !== 'entra' || row.oid !== oid) {
		if (row) await fehlversuch(row.personId, 'entra', ip);
		return false;
	}
	await merken(sessionId, row.personId, 'entra', ip);
	return true;
}
