import type { Cookies } from '@sveltejs/kit';
import { audit } from '../audit.ts';
import { activatePerson, endPending, personBasics, type Pending } from './local.ts';
import { createSession, setSessionCookie } from './session.ts';

/** Schließt eine lokale Anmeldung ab und gibt das Rücksprungziel zurück. */
export async function completeLocalLogin(
	cookies: Cookies,
	pending: Pending,
	meta: { userAgent: string | null; ip: string; method: 'totp' | 'passkey' | 'recovery' | 'setup' }
): Promise<string> {
	await activatePerson(pending.personId);
	await endPending(cookies, pending.id);
	const session = await createSession(pending.personId, 'local', meta);
	setSessionCookie(cookies, session.token, session.expiresAt);
	const person = await personBasics(pending.personId);
	await audit({
		category: 'security',
		action: 'login.local.success',
		actorId: pending.personId,
		tenantId: person?.tenantId,
		details: { method: meta.method },
		ip: meta.ip
	});
	return pending.ziel;
}

/** Passwortlose Anmeldung mit Passkey abschließen (ohne halbfertige Anmeldung). */
export async function completePasskeyLogin(
	cookies: Cookies,
	personId: string,
	meta: { userAgent: string | null; ip: string }
) {
	const session = await createSession(personId, 'local', meta);
	setSessionCookie(cookies, session.token, session.expiresAt);
	const person = await personBasics(personId);
	await audit({
		category: 'security',
		action: 'login.local.success',
		actorId: personId,
		tenantId: person?.tenantId,
		details: { method: 'passkey-direkt' },
		ip: meta.ip
	});
}
