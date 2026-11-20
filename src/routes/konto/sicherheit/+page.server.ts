import { error, fail } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { audit } from '#lib/server/audit.ts';
import { remainingRecoveryCodes, replaceRecoveryCodes } from '#lib/server/auth/local.ts';
import { verifyPassword } from '#lib/server/auth/password.ts';
import { db } from '#lib/server/db/index.ts';
import { localCredentials, passkeys } from '#lib/server/db/schema.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.person || !locals.session) error(401);
	if (locals.session.authMethod !== 'local') return { lokal: false as const };

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
		totp: Boolean(cred?.totp),
		passkeys: keys,
		restCodes: await remainingRecoveryCodes(locals.person.id)
	};
};

export const actions: Actions = {
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
