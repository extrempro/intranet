/**
 * Lokale Konten (Kap. 4.2): Einladung, Passwort, zweiter Faktor, Wiederherstellungscodes.
 * Ablauf: Einladung → Passwort setzen → zweiten Faktor einrichten → Codes sichern → Sitzung.
 * Anmeldung: Passwort → TOTP, Passkey oder Wiederherstellungscode → Sitzung.
 */
import type { Cookies } from '@sveltejs/kit';
import { and, eq, gt, isNull, lt, sql } from 'drizzle-orm';
import {
	checkPasswordPolicy,
	normalizePolicy,
	type PasswordPolicy,
	type PasswordProblem
} from '../../password.ts';
import { tenantFromEmail } from '../../tenant.ts';
import { getSetting } from '../settings.ts';
import { audit } from '../audit.ts';
import { seedFavorites } from '../preferences.ts';
import { decryptSecret, encryptSecret, randomToken, sha256Hex } from '../crypto.ts';
import { db } from '../db/index.ts';
import {
	invitations,
	localCredentials,
	passkeys,
	pendingLogins,
	persons,
	recoveryCodes,
	tenantDomains
} from '../db/schema.ts';
import { escapeHtml, sendMail } from '../mail.ts';
import { burnPasswordTime, hashPassword, isPwnedPassword, verifyPassword } from './password.ts';
import { generateRecoveryCodes, normalizeRecoveryCode } from './recovery.ts';
import { remainingWaitMs } from './throttle.ts';
import { verifyTotpStep } from './totp.ts';

export const PENDING_COOKIE = '__Host-intranet-anmeldung';
const PENDING_TTL_MS = 15 * 60 * 1000;
const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Einladung
// ---------------------------------------------------------------------------

export type InviteResult =
	| { ok: true; personId: string }
	| { ok: false; reason: 'unknown_domain' | 'forbidden' | 'exists' | 'mail_failed' };

export async function inviteLocalPerson(input: {
	email: string;
	displayName: string;
	invitedBy: string;
	origin: string;
	ip: string;
	/** Darf die einladende Person Konten in diesem Mandanten anlegen? */
	mayInvite: (tenantId: string) => boolean;
	/** Fester Mandant statt Ableitung aus der Domain (Betreiber-Konten externer Firmen). */
	tenantId?: string;
}): Promise<InviteResult> {
	const email = input.email.trim();
	const domains = Object.fromEntries(
		(await db.select().from(tenantDomains)).map((d) => [d.domain, d.tenantId])
	);
	const tenantId = input.tenantId ?? tenantFromEmail(email, domains);
	if (!tenantId) return { ok: false, reason: 'unknown_domain' };
	if (!input.mayInvite(tenantId)) return { ok: false, reason: 'forbidden' };

	const [existing] = await db
		.select()
		.from(persons)
		.where(sql`lower(${persons.email}) = lower(${email})`);
	// Erneut einladen geht nur, solange die Einladung nicht angenommen ist.
	if (existing && !(existing.authSource === 'local' && existing.status === 'invited')) {
		return { ok: false, reason: 'exists' };
	}

	const token = randomToken();
	const personId = await db.transaction(async (tx) => {
		let id = existing?.id;
		if (!id) {
			const [row] = await tx
				.insert(persons)
				.values({
					tenantId,
					email,
					displayName: input.displayName.trim(),
					authSource: 'local',
					status: 'invited'
				})
				.returning({ id: persons.id });
			id = row.id;
			await tx.insert(localCredentials).values({ personId: id });
		}
		// Ältere Einladungen werden ungültig
		await tx.delete(invitations).where(eq(invitations.personId, id));
		await tx.insert(invitations).values({
			tokenHash: sha256Hex(token),
			personId: id,
			expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
			createdBy: input.invitedBy
		});
		return id;
	});
	// Neue Person: Standard-Favoriten ihres Mandanten (Kap. 7)
	if (!existing) await seedFavorites(personId, tenantId);

	const link = new URL(`/einladung/${token}`, input.origin).href;
	const name = input.displayName.trim();
	try {
		await sendMail({
			to: email,
			subject: 'Deine Einladung ins Intranet',
			text: `Hallo ${name},\n\ndu bist ins Intranet eingeladen. Leg dein Passwort und deinen zweiten Faktor hier fest:\n${link}\n\nDer Link gilt 7 Tage und nur einmal.`,
			html: `<p>Hallo ${escapeHtml(name)},</p><p>du bist ins Intranet eingeladen. Leg dein Passwort und deinen zweiten Faktor hier fest:</p><p><a href="${escapeHtml(link)}">Einladung annehmen</a></p><p>Der Link gilt 7 Tage und nur einmal.</p>`
		});
	} catch (err) {
		console.error('Einladung konnte nicht gesendet werden:', err);
		await audit({
			category: 'admin',
			action: 'invitation.mail_failed',
			actorId: input.invitedBy,
			tenantId,
			entityType: 'person',
			entityId: personId,
			ip: input.ip
		});
		return { ok: false, reason: 'mail_failed' };
	}

	await audit({
		category: 'admin',
		action: existing ? 'invitation.resent' : 'invitation.created',
		actorId: input.invitedBy,
		tenantId,
		entityType: 'person',
		entityId: personId,
		ip: input.ip
	});
	return { ok: true, personId };
}

export async function findInvitation(token: string) {
	const [row] = await db
		.select({
			personId: invitations.personId,
			displayName: persons.displayName,
			email: persons.email
		})
		.from(invitations)
		.innerJoin(persons, eq(persons.id, invitations.personId))
		.where(
			and(
				eq(invitations.tokenHash, sha256Hex(token)),
				isNull(invitations.usedAt),
				gt(invitations.expiresAt, new Date()),
				eq(persons.status, 'invited')
			)
		);
	return row ?? null;
}

/** Passwortrichtlinie aus Verwaltung → Anmeldung (Kap. 4.2). */
export async function passwordPolicy(): Promise<PasswordPolicy> {
	return normalizePolicy(await getSetting<unknown>('password.policy', null));
}

export type NewPasswordProblem = PasswordProblem | 'pwned' | 'mismatch';

/** Richtlinie und HIBP. Ist HIBP nicht erreichbar, wird angenommen und protokolliert. */
export async function checkNewPassword(
	password: string,
	repeat: string,
	ctx: { personId: string; ip: string }
): Promise<NewPasswordProblem | null> {
	if (password !== repeat) return 'mismatch';
	const policy = checkPasswordPolicy(password, (await passwordPolicy()).minLength);
	if (policy) return policy;
	const pwned = await isPwnedPassword(password);
	if (pwned === null) {
		await audit({
			category: 'security',
			action: 'password.hibp_unavailable',
			actorId: ctx.personId,
			ip: ctx.ip
		});
	}
	return pwned ? 'pwned' : null;
}

/** Setzt das Passwort und verbraucht die Einladung. */
export async function acceptInvitation(token: string, personId: string, password: string) {
	const passwordHash = await hashPassword(password);
	return db.transaction(async (tx) => {
		const used = await tx
			.update(invitations)
			.set({ usedAt: new Date() })
			.where(and(eq(invitations.tokenHash, sha256Hex(token)), isNull(invitations.usedAt)))
			.returning({ personId: invitations.personId });
		if (used.length !== 1 || used[0].personId !== personId) return false;
		await tx
			.update(localCredentials)
			.set({ passwordHash, passwordChangedAt: new Date(), failedAttempts: 0, lastFailedAt: null })
			.where(eq(localCredentials.personId, personId));
		return true;
	});
}

// ---------------------------------------------------------------------------
// Anmeldung mit Passwort
// ---------------------------------------------------------------------------

export type PasswordLoginResult =
	| { ok: true; personId: string; needsSetup: boolean }
	| { ok: false; reason: 'invalid' } // bewusst ohne Unterscheidung
	| { ok: false; reason: 'wait'; seconds: number };

export async function loginWithPassword(
	email: string,
	password: string,
	ip: string
): Promise<PasswordLoginResult> {
	const [row] = await db
		.select({
			id: persons.id,
			tenantId: persons.tenantId,
			status: persons.status,
			authSource: persons.authSource,
			cred: localCredentials
		})
		.from(persons)
		.innerJoin(localCredentials, eq(localCredentials.personId, persons.id))
		.where(sql`lower(${persons.email}) = lower(${email.trim()})`);

	if (!row || row.authSource !== 'local' || !row.cred.passwordHash || row.status === 'disabled') {
		await burnPasswordTime(password);
		await audit({
			category: 'security',
			action: 'login.local.failed',
			details: { known: false },
			ip
		});
		return { ok: false, reason: 'invalid' };
	}

	const wait = remainingWaitMs(row.cred.failedAttempts, row.cred.lastFailedAt);
	if (wait > 0) return { ok: false, reason: 'wait', seconds: Math.ceil(wait / 1000) };

	if (!(await verifyPassword(row.cred.passwordHash, password))) {
		await db
			.update(localCredentials)
			.set({
				failedAttempts: sql`${localCredentials.failedAttempts} + 1`,
				lastFailedAt: new Date()
			})
			.where(eq(localCredentials.personId, row.id));
		await audit({
			category: 'security',
			action: 'login.local.failed',
			actorId: row.id,
			tenantId: row.tenantId,
			details: { attempt: row.cred.failedAttempts + 1 },
			ip
		});
		return { ok: false, reason: 'invalid' };
	}

	const [{ count }] = await db
		.select({ count: sql<number>`count(*)::int` })
		.from(passkeys)
		.where(eq(passkeys.personId, row.id));
	const hasSecondFactor = row.cred.totpConfirmedAt !== null || count > 0;
	return { ok: true, personId: row.id, needsSetup: !hasSecondFactor || row.status === 'invited' };
}

async function registerFailure(personId: string) {
	await db
		.update(localCredentials)
		.set({ failedAttempts: sql`${localCredentials.failedAttempts} + 1`, lastFailedAt: new Date() })
		.where(eq(localCredentials.personId, personId));
}

export async function resetFailures(personId: string) {
	await db
		.update(localCredentials)
		.set({ failedAttempts: 0, lastFailedAt: null })
		.where(eq(localCredentials.personId, personId));
}

/** Wartezeit auch für den zweiten Faktor (Raten von Codes). */
export async function secondFactorWait(personId: string): Promise<number> {
	const [c] = await db
		.select({ n: localCredentials.failedAttempts, at: localCredentials.lastFailedAt })
		.from(localCredentials)
		.where(eq(localCredentials.personId, personId));
	return c ? Math.ceil(remainingWaitMs(c.n, c.at) / 1000) : 0;
}

// ---------------------------------------------------------------------------
// Halbfertige Anmeldung
// ---------------------------------------------------------------------------

export type Pending = typeof pendingLogins.$inferSelect;

export async function startPending(
	cookies: Cookies,
	personId: string,
	purpose: 'mfa' | 'setup',
	ziel: string
) {
	const token = randomToken();
	await db.delete(pendingLogins).where(lt(pendingLogins.expiresAt, new Date()));
	await db.insert(pendingLogins).values({
		id: sha256Hex(token),
		personId,
		purpose,
		ziel,
		expiresAt: new Date(Date.now() + PENDING_TTL_MS)
	});
	cookies.set(PENDING_COOKIE, token, {
		path: '/',
		httpOnly: true,
		secure: true,
		sameSite: 'strict',
		maxAge: PENDING_TTL_MS / 1000
	});
}

export async function getPending(
	cookies: Cookies,
	purpose: 'mfa' | 'setup'
): Promise<Pending | null> {
	const token = cookies.get(PENDING_COOKIE);
	if (!token) return null;
	const [row] = await db
		.select()
		.from(pendingLogins)
		.where(and(eq(pendingLogins.id, sha256Hex(token)), gt(pendingLogins.expiresAt, new Date())));
	return row && row.purpose === purpose ? row : null;
}

export async function updatePending(
	id: string,
	values: Partial<Pick<Pending, 'challenge' | 'pendingTotpEnc' | 'setupDone'>>
) {
	await db.update(pendingLogins).set(values).where(eq(pendingLogins.id, id));
}

export async function endPending(cookies: Cookies, id: string) {
	await db.delete(pendingLogins).where(eq(pendingLogins.id, id));
	cookies.delete(PENDING_COOKIE, { path: '/', httpOnly: true, secure: true, sameSite: 'strict' });
}

// ---------------------------------------------------------------------------
// Zweiter Faktor
// ---------------------------------------------------------------------------

export async function verifyTotpForPerson(personId: string, code: string): Promise<boolean> {
	const [c] = await db
		.select()
		.from(localCredentials)
		.where(eq(localCredentials.personId, personId));
	if (!c?.totpSecretEnc || !c.totpConfirmedAt) return false;
	const step = verifyTotpStep(decryptSecret(c.totpSecretEnc), code, c.totpLastStep);
	if (step === null) {
		await registerFailure(personId);
		return false;
	}
	// Bedingt schreiben, damit zwei gleichzeitige Anfragen den Code nicht doppelt nutzen
	const updated = await db
		.update(localCredentials)
		.set({ totpLastStep: step, failedAttempts: 0, lastFailedAt: null })
		.where(
			and(
				eq(localCredentials.personId, personId),
				sql`coalesce(${localCredentials.totpLastStep}, -1) < ${step}`
			)
		)
		.returning({ personId: localCredentials.personId });
	return updated.length === 1;
}

export async function useRecoveryCode(personId: string, input: string): Promise<boolean> {
	const code = normalizeRecoveryCode(input);
	if (code.length !== 12) {
		await registerFailure(personId);
		return false;
	}
	const used = await db
		.update(recoveryCodes)
		.set({ usedAt: new Date() })
		.where(
			and(
				eq(recoveryCodes.personId, personId),
				eq(recoveryCodes.codeHash, sha256Hex(code)),
				isNull(recoveryCodes.usedAt)
			)
		)
		.returning({ id: recoveryCodes.id });
	if (used.length !== 1) {
		await registerFailure(personId);
		return false;
	}
	await resetFailures(personId);
	return true;
}

export async function remainingRecoveryCodes(personId: string): Promise<number> {
	const [{ n }] = await db
		.select({ n: sql<number>`count(*)::int` })
		.from(recoveryCodes)
		.where(and(eq(recoveryCodes.personId, personId), isNull(recoveryCodes.usedAt)));
	return n;
}

/** Erzeugt 10 neue Codes und macht alle alten ungültig. Gibt die Codes einmalig im Klartext zurück. */
export async function replaceRecoveryCodes(personId: string): Promise<string[]> {
	const codes = generateRecoveryCodes();
	await db.transaction(async (tx) => {
		await tx.delete(recoveryCodes).where(eq(recoveryCodes.personId, personId));
		await tx
			.insert(recoveryCodes)
			.values(codes.map((c) => ({ personId, codeHash: sha256Hex(normalizeRecoveryCode(c)) })));
	});
	return codes;
}

/** TOTP aus der Einrichtung übernehmen, wenn der Code passt. */
export async function confirmTotpSetup(pending: Pending, code: string): Promise<boolean> {
	if (!pending.pendingTotpEnc) return false;
	const step = verifyTotpStep(decryptSecret(pending.pendingTotpEnc), code, null);
	if (step === null) return false;
	await db
		.update(localCredentials)
		.set({ totpSecretEnc: pending.pendingTotpEnc, totpConfirmedAt: new Date(), totpLastStep: step })
		.where(eq(localCredentials.personId, pending.personId));
	await updatePending(pending.id, { pendingTotpEnc: null });
	return true;
}

export function encryptTotpKey(key: Uint8Array): string {
	return encryptSecret(key);
}

/** Einrichtung abgeschlossen: Konto wird aktiv. */
export async function activatePerson(personId: string) {
	await db
		.update(persons)
		.set({ status: 'active', lastLoginAt: new Date() })
		.where(and(eq(persons.id, personId), eq(persons.status, 'invited')));
	await db.update(persons).set({ lastLoginAt: new Date() }).where(eq(persons.id, personId));
}

export async function personBasics(personId: string) {
	const [p] = await db
		.select({
			id: persons.id,
			email: persons.email,
			displayName: persons.displayName,
			tenantId: persons.tenantId
		})
		.from(persons)
		.where(eq(persons.id, personId));
	return p ?? null;
}
