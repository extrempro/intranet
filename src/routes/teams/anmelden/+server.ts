import { json, type RequestHandler } from '@sveltejs/kit';
import { audit } from '#lib/server/audit.ts';
import { finishEntraLogin } from '#lib/server/auth/entra-finish.ts';
import { DENIED_MESSAGES } from '#lib/server/auth/entra-login.ts';
import { oboGraphToken, safeReturnTo } from '#lib/server/auth/entra.ts';
import { createSession, setTeamsSessionCookie } from '#lib/server/auth/session.ts';
import { loginLimit } from '#lib/server/rate-limit.ts';
import { TeamsSsoError, verifyTeamsToken } from '#lib/server/teams-sso.ts';

/** Teams-App: Ist hier schon eine Teams-Sitzung? Dann ist kein neuer Tausch nötig. */
export const GET: RequestHandler = ({ locals }) =>
	json(
		{ angemeldet: Boolean(locals.person && locals.teams) },
		{ headers: { 'Cache-Control': 'no-store' } }
	);

/**
 * Teams-App: SSO-Token von Teams prüfen, gegen ein Graph-Token tauschen
 * (On-Behalf-Of) und wie bei der normalen Microsoft-Anmeldung abgleichen.
 * Legt eine Sitzung mit dem Teams-Cookie an.
 */
export const POST: RequestHandler = async ({ request, url, cookies, getClientAddress }) => {
	const ip = getClientAddress();
	if (!loginLimit.hit(ip))
		return json({ fehler: 'Zu viele Anmeldeversuche. Warte bitte kurz.' }, { status: 429 });
	const origin = process.env.ORIGIN?.trim() || url.origin;
	const auth = request.headers.get('authorization') ?? '';
	const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
	if (!token || token.length > 8000)
		return json({ fehler: 'Kein Token erhalten.' }, { status: 400 });
	const body = (await request.json().catch(() => ({}))) as { ziel?: unknown };
	const ziel = safeReturnTo(typeof body.ziel === 'string' ? body.ziel : '/');

	const deny = async (reason: string, status: number, text: string, details = {}) => {
		await audit({
			category: 'security',
			action: 'login.entra.denied',
			details: { reason, teams: true, ...details },
			ip
		});
		return json({ fehler: text }, { status });
	};

	let oid: string;
	try {
		oid = (await verifyTeamsToken(token, origin)).oid;
	} catch (err) {
		if (err instanceof TeamsSsoError) return deny('failed', 401, err.message, { cause: 'sso' });
		throw err;
	}

	let graphToken: string;
	try {
		graphToken = await oboGraphToken(token);
	} catch (err) {
		const msg = err instanceof Error ? err.message : '';
		console.error('Teams-SSO: Tausch gegen Graph-Token fehlgeschlagen:', msg);
		return deny(
			'failed',
			502,
			/AADSTS65001|consent/i.test(msg)
				? 'Für die Intranet-App fehlt die Zustimmung in Microsoft Entra (delegierte Rechte User.Read und GroupMember.Read.All).'
				: 'Die Anmeldung bei Microsoft hat nicht geklappt.',
			{ cause: 'obo' }
		);
	}

	const r = await finishEntraLogin(oid, graphToken);
	if (!r.ok) {
		const text =
			DENIED_MESSAGES[r.reason as keyof typeof DENIED_MESSAGES] ?? DENIED_MESSAGES.failed;
		return deny(r.reason, 403, text, r.cause ? { cause: r.cause } : { oid });
	}

	const session = await createSession(r.personId, 'entra', {
		userAgent: request.headers.get('user-agent'),
		ip
	});
	setTeamsSessionCookie(cookies, session.token, session.expiresAt);
	await audit({
		category: 'security',
		action: 'login.entra.success',
		actorId: r.personId,
		tenantId: r.tenantId,
		details: { created: r.created, roles: r.roles, teams: true },
		ip
	});
	return json({ ok: true, ziel }, { headers: { 'Cache-Control': 'no-store' } });
};
