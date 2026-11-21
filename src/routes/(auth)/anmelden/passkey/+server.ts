import { error, json, type RequestHandler } from '@sveltejs/kit';
import { completeLocalLogin, completePasskeyLogin } from '#lib/server/auth/complete.ts';
import { randomToken, sha256Hex } from '#lib/server/crypto.ts';
import { loginLimit } from '#lib/server/rate-limit.ts';
import { safeReturnTo } from '#lib/server/auth/entra.ts';
import {
	getPending,
	personBasics,
	replaceRecoveryCodes,
	secondFactorWait,
	updatePending
} from '#lib/server/auth/local.ts';
import {
	authenticationOptions,
	directOptions,
	verifyDirect,
	registrationOptions,
	verifyAuthentication,
	verifyRegistration
} from '#lib/server/auth/passkey.ts';

const DIREKT_COOKIE = '__Host-intranet-passkey';
const DIREKT_MS = 5 * 60_000;
/** Offene Challenges der passwortlosen Anmeldung (einmalig, 5 Minuten) */
const offen = new Map<string, { challenge: string; bis: number }>();
function merken(id: string, challenge: string) {
	const jetzt = Date.now();
	for (const [k, v] of offen) if (v.bis < jetzt) offen.delete(k);
	if (offen.size > 10_000) offen.clear();
	offen.set(id, { challenge, bis: jetzt + DIREKT_MS });
}
function holen(id: string): string | null {
	const e = offen.get(id);
	offen.delete(id);
	return e && e.bis > Date.now() ? e.challenge : null;
}

/**
 * Passkey während der Anmeldung: Optionen holen und Antwort prüfen.
 * Nur mit gültiger halbfertiger Anmeldung (Cookie, SameSite=Strict).
 */
export const POST: RequestHandler = async ({ request, cookies, url, getClientAddress }) => {
	const body = (await request.json().catch(() => null)) as {
		aktion?: string;
		antwort?: unknown;
		name?: string;
		ziel?: string;
	} | null;
	if (!body?.aktion) error(400, 'Ungültige Anfrage');
	const origin = url.origin;
	const meta = { userAgent: request.headers.get('user-agent'), ip: getClientAddress() };

	// Passwortlos: Challenge nur im Speicher, Zuordnung über ein kurzlebiges Cookie
	if (body.aktion === 'direkt-optionen') {
		if (!loginLimit.hit(meta.ip))
			return json({ ok: false, warten: loginLimit.retryAfter(meta.ip) }, { status: 429 });
		const options = await directOptions(origin);
		const token = randomToken();
		merken(sha256Hex(token), options.challenge);
		cookies.set(DIREKT_COOKIE, token, {
			path: '/',
			httpOnly: true,
			secure: true,
			sameSite: 'strict',
			maxAge: DIREKT_MS / 1000
		});
		return json(options);
	}
	if (body.aktion === 'direkt') {
		const token = cookies.get(DIREKT_COOKIE);
		cookies.delete(DIREKT_COOKIE, { path: '/', httpOnly: true, secure: true, sameSite: 'strict' });
		const challenge = token ? holen(sha256Hex(token)) : null;
		if (!challenge) error(401, 'Anmeldung abgelaufen');
		const r = await verifyDirect(
			body.antwort as Parameters<typeof verifyDirect>[0],
			challenge,
			origin
		);
		if (!r.ok) return json({ ok: false, warten: r.warten }, { status: r.warten ? 429 : 400 });
		await completePasskeyLogin(cookies, r.personId, meta);
		const ziel = safeReturnTo(String(body.ziel ?? '/'));
		return json({ ok: true, ziel });
	}

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
