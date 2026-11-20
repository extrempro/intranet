import { error, json, type RequestHandler } from '@sveltejs/kit';
import { completeLocalLogin } from '#lib/server/auth/complete.ts';
import {
	getPending,
	personBasics,
	replaceRecoveryCodes,
	secondFactorWait,
	updatePending
} from '#lib/server/auth/local.ts';
import {
	authenticationOptions,
	registrationOptions,
	verifyAuthentication,
	verifyRegistration
} from '#lib/server/auth/passkey.ts';

/**
 * Passkey während der Anmeldung: Optionen holen und Antwort prüfen.
 * Nur mit gültiger halbfertiger Anmeldung (Cookie, SameSite=Strict).
 */
export const POST: RequestHandler = async ({ request, cookies, url, getClientAddress }) => {
	const body = (await request.json().catch(() => null)) as {
		aktion?: string;
		antwort?: unknown;
		name?: string;
	} | null;
	if (!body?.aktion) error(400, 'Ungültige Anfrage');
	const origin = url.origin;
	const meta = { userAgent: request.headers.get('user-agent'), ip: getClientAddress() };

	if (body.aktion === 'registrieren-optionen' || body.aktion === 'registrieren') {
		const pending = await getPending(cookies, 'setup');
		if (!pending) error(401, 'Anmeldung abgelaufen');
		if (body.aktion === 'registrieren-optionen') {
			const person = await personBasics(pending.personId);
			if (!person) error(401, 'Anmeldung abgelaufen');
			return json(await registrationOptions(pending, person, origin));
		}
		const ok = await verifyRegistration(
			pending,
			body.antwort as Parameters<typeof verifyRegistration>[1],
			origin,
			String(body.name ?? '')
		);
		if (!ok) return json({ ok: false }, { status: 400 });
		const codes = await replaceRecoveryCodes(pending.personId);
		await updatePending(pending.id, { setupDone: true });
		return json({ ok: true, codes });
	}

	if (body.aktion === 'anmelden-optionen' || body.aktion === 'anmelden') {
		const pending = await getPending(cookies, 'mfa');
		if (!pending) error(401, 'Anmeldung abgelaufen');
		const wait = await secondFactorWait(pending.personId);
		if (wait > 0) return json({ ok: false, warten: wait }, { status: 429 });
		if (body.aktion === 'anmelden-optionen') {
			return json(await authenticationOptions(pending, origin));
		}
		const ok = await verifyAuthentication(
			pending,
			body.antwort as Parameters<typeof verifyAuthentication>[1],
			origin
		);
		if (!ok) return json({ ok: false }, { status: 400 });
		const ziel = await completeLocalLogin(cookies, pending, { ...meta, method: 'passkey' });
		return json({ ok: true, ziel });
	}

	error(400, 'Ungültige Anfrage');
};
