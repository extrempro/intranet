import { json, type RequestHandler } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { loginLimit } from '#lib/server/rate-limit.ts';
import { db } from '#lib/server/db/index.ts';
import { persons } from '#lib/server/db/schema.ts';
import { TeamsSsoError, verifyTeamsToken } from '#lib/server/teams-sso.ts';

/** Teams-Test: SSO-Token prüfen. Legt keine Sitzung an. */
export const POST: RequestHandler = async ({ request, url, getClientAddress }) => {
	const origin = process.env.ORIGIN?.trim() || url.origin;
	const auth = request.headers.get('authorization') ?? '';
	const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
	if (!token || token.length > 8000)
		return json({ fehler: 'Kein Token erhalten.' }, { status: 400 });
	const ip = getClientAddress();
	if (!loginLimit.hit(ip)) return json({ fehler: 'Zu viele Versuche.' }, { status: 429 });
	try {
		const id = await verifyTeamsToken(token, origin);
		const [p] = await db
			.select({ status: persons.status })
			.from(persons)
			.where(eq(persons.entraOid, id.oid));
		return json({ name: id.name, upn: id.upn, bekannt: p?.status === 'active' });
	} catch (err) {
		if (err instanceof TeamsSsoError) return json({ fehler: err.message }, { status: 401 });
		throw err;
	}
};
