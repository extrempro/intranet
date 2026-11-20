import { error, fail } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { audit } from '#lib/server/audit.ts';
import { remainingRecoveryCodes, replaceRecoveryCodes } from '#lib/server/auth/local.ts';
import { verifyPassword } from '#lib/server/auth/password.ts';
import { endOtherSessions, endOwnSession, listSessions } from '#lib/server/auth/session.ts';
import { db } from '#lib/server/db/index.ts';
import { localCredentials, passkeys } from '#lib/server/db/schema.ts';
import type { Actions, PageServerLoad } from './$types';

async function sessionsFor(personId: string, currentId: string) {
	return (await listSessions(personId)).map((s) => ({
		id: s.id,
		aktuell: s.id === currentId,
		art: s.authMethod,
		seit: s.createdAt,
		zuletzt: s.lastActiveAt,
		geraet: s.userAgent,
		netz: s.ipPrefix
	}));
}

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.person || !locals.session) error(401);
	const sitzungen = await sessionsFor(locals.person.id, locals.session.id);
	if (locals.session.authMethod !== 'local') return { lokal: false as const, sitzungen };

	const [cred] = await db
		.select({ totp: localCredentials.totpConfirmedAt })
		.from(localCredentials)
		.where(eq(localCredentials.personId, locals.person.id));
	const keys = await db
		.select({ name: passkeys.name, createdAt: passkeys.createdAt, lastUsedAt: passkeys.lastUsedAt })
		.from(passkeys)
		.where(eq(passkeys.personId, locals.person.id));
	return {
		lokal: true as const,
		sitzungen,
		totp: Boolean(cred?.totp),
		passkeys: keys,
		restCodes: await remainingRecoveryCodes(locals.person.id)
	};
};

export const actions: Actions = {
	sitzungBeenden: async ({ request, locals, getClientAddress }) => {
		if (!locals.person || !locals.session) error(401);
		const id = String((await request.formData()).get('id') ?? '');
		if (id === locals.session.id)
			return fail(400, { sitzungFehler: 'Zum Beenden dieser Sitzung melde dich ab.' });
		if (await endOwnSession(locals.person.id, id)) {
			await audit({
				category: 'security',
				action: 'session.ended',
				actorId: locals.person.id,
				tenantId: locals.person.tenantId,
				ip: getClientAddress()
			});
		}
		return { sitzungBeendet: true };
	},

	andereBeenden: async ({ locals, getClientAddress }) => {
		if (!locals.person || !locals.session) error(401);
		const n = await endOtherSessions(locals.person.id, locals.session.id);
		await audit({
			category: 'security',
			action: 'session.ended_others',
			actorId: locals.person.id,
			tenantId: locals.person.tenantId,
			details: { anzahl: n },
			ip: getClientAddress()
		});
		return { sitzungBeendet: true };
	},

	neueCodes: async ({ request, locals, getClientAddress }) => {
		if (!locals.person || locals.session?.authMethod !== 'local') error(403);
		const password = String((await request.formData()).get('passwort') ?? '');
		const [cred] = await db
			.select({ hash: localCredentials.passwordHash })
			.from(localCredentials)
			.where(eq(localCredentials.personId, locals.person.id));
		if (!cred?.hash || !(await verifyPassword(cred.hash, password))) {
			return fail(400, { fehler: 'Das Passwort stimmt nicht.' });
		}
		const codes = await replaceRecoveryCodes(locals.person.id);
		await audit({
			category: 'security',
			action: 'recovery_codes.regenerated',
			actorId: locals.person.id,
			tenantId: locals.person.tenantId,
			ip: getClientAddress()
		});
		return { codes };
	}
};
