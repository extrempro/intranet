import { error, fail } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { audit } from '#lib/server/audit.ts';
import {
	changePassword,
	checkCurrentPassword,
	passwordPolicy,
	remainingRecoveryCodes,
	replaceRecoveryCodes
} from '#lib/server/auth/local.ts';
import { passwordMessage } from '#lib/password.ts';
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
		email: locals.person.email,
		min: (await passwordPolicy()).minLength,
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
		const password = String((await request.formData()).get('passwort') ?? '').slice(0, 512);
		const check = await checkCurrentPassword(locals.person.id, password, getClientAddress());
		if (!check.ok)
			return fail(check.reason === 'wait' ? 429 : 400, {
				fehler:
					check.reason === 'wait'
						? `Zu viele Fehlversuche. Warte bitte ${check.seconds} Sekunden.`
						: 'Das Passwort stimmt nicht.'
			});
		const codes = await replaceRecoveryCodes(locals.person.id);
		await audit({
			category: 'security',
			action: 'recovery_codes.regenerated',
			actorId: locals.person.id,
			tenantId: locals.person.tenantId,
			ip: getClientAddress()
		});
		return { codes };
	},

	passwort: async ({ request, locals, getClientAddress }) => {
		if (!locals.person || !locals.session || locals.session.authMethod !== 'local') error(403);
		const f = await request.formData();
		const r = await changePassword({
			personId: locals.person.id,
			current: String(f.get('aktuell') ?? '').slice(0, 512),
			next: String(f.get('passwort') ?? '').slice(0, 512),
			repeat: String(f.get('wiederholung') ?? '').slice(0, 512),
			ip: getClientAddress(),
			keepSessionId: locals.session.id
		});
		if (!r.ok) {
			const fehler =
				r.reason === 'wait'
					? `Zu viele Fehlversuche. Warte bitte ${r.seconds} Sekunden.`
					: r.reason === 'wrong'
						? 'Dein aktuelles Passwort stimmt nicht.'
						: r.reason === 'same'
							? 'Das neue Passwort muss sich vom aktuellen unterscheiden.'
							: passwordMessage(r.reason, (await passwordPolicy()).minLength);
			return fail(r.reason === 'wait' ? 429 : 400, { bereich: 'passwort', fehler });
		}
		return {
			bereich: 'passwort',
			passwortGeaendert:
				r.beendet > 0
					? `Passwort geändert. ${r.beendet} ${r.beendet === 1 ? 'anderes Gerät wurde' : 'andere Geräte wurden'} abgemeldet.`
					: 'Passwort geändert.'
		};
	}
};
