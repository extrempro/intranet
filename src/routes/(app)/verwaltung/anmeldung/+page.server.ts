import { fail } from '@sveltejs/kit';
import {
	normalizePolicy,
	PASSWORD_MIN_OPTIONS,
	RESET_MINUTES_OPTIONS,
	type PasswordPolicy
} from '#lib/password.ts';
import { isSystemAdmin } from '#lib/server/auth/access.ts';
import {
	checkEntraConnection,
	clearGraphTokenCache,
	ENTRA_FIELDS,
	entraSettingsView,
	getEntraConfig,
	parseEntraForm
} from '#lib/server/auth/entra.ts';
import { lastSync, runEntraSync, syncRunning, syncTime } from '#lib/server/auth/entra-sync.ts';
import { requirePrincipal, requireThat } from '#lib/server/auth/guard.ts';
import { passwordPolicy } from '#lib/server/auth/local.ts';
import {
	clearIdleCache,
	DEFAULT_IDLE,
	IDLE_OPTIONS,
	type IdleOption
} from '#lib/server/auth/session.ts';
import { audit } from '#lib/server/audit.ts';
import { getSetting, setSetting } from '#lib/server/settings.ts';
import type { Actions, PageServerLoad } from './$types';

/** Anmeldung (Kap. 4, 14): Entra-Verbindung, Abgleich, Passwortrichtlinie, Inaktivität. Nur System-Admins. */
function admin(locals: App.Locals) {
	const p = requirePrincipal(locals);
	requireThat(isSystemAdmin(p));
	return p;
}

export const load: PageServerLoad = async ({ locals, url }) => {
	admin(locals);
	return {
		idle: await getSetting<string>('session.idle', DEFAULT_IDLE),
		richtlinie: await passwordPolicy(),
		entra: await entraSettingsView(),
		umleitung: new URL('/anmelden/entra/callback', url.origin).href,
		abgleich: {
			eingerichtet: Boolean(await getEntraConfig()),
			uhrzeit: syncTime(),
			laeuft: syncRunning(),
			letzter: await lastSync()
		}
	};
};

async function log(
	personId: string,
	entityId: string,
	vorher: unknown,
	nachher: unknown,
	ip: string
) {
	await audit({
		category: 'admin',
		action: 'settings.update',
		actorId: personId,
		entityType: 'setting',
		entityId,
		details: { vorher, nachher },
		ip
	});
}

export const actions: Actions = {
	entra: async ({ request, locals, getClientAddress }) => {
		const p = admin(locals);
		const form = Object.fromEntries(
			[...(await request.formData())].map(([k, v]) => [k, String(v).slice(0, 100)])
		);
		const { fehler, werte } = parseEntraForm(form);
		if (Object.keys(fehler).length)
			return fail(400, {
				bereich: 'entra',
				fehler: 'Bitte prüfe die markierten Felder.',
				felder: fehler,
				werte: form
			});
		const vorher = await getSetting<Record<string, string>>('entra', {});
		// Andere gespeicherte Schlüssel (falls vorhanden) bleiben erhalten
		const neu: Record<string, string> = { ...vorher };
		for (const f of ENTRA_FIELDS) {
			if (werte[f]) neu[f] = werte[f];
			else delete neu[f];
		}
		await setSetting('entra', neu, p.personId);
		clearGraphTokenCache();
		await log(p.personId, 'entra', vorher, neu, getClientAddress());
		return { bereich: 'entra', gespeichert: true };
	},

	pruefen: async ({ locals }) => {
		admin(locals);
		return { bereich: 'pruefung', pruefung: await checkEntraConnection() };
	},

	abgleichen: async ({ locals, request, getClientAddress }) => {
		const p = admin(locals);
		if (!(await getEntraConfig()))
			return fail(400, {
				bereich: 'abgleich',
				fehler: 'Die Anmeldung mit Microsoft ist nicht eingerichtet.'
			});
		if (syncRunning())
			return fail(409, { bereich: 'abgleich', fehler: 'Der Abgleich läuft bereits.' });
		const trotzdem = (await request.formData()).get('trotzdem') === 'ja';
		await audit({
			category: 'admin',
			action: 'entra.sync_start',
			actorId: p.personId,
			details: { trotzdem },
			ip: getClientAddress()
		});
		// Im Hintergrund; die Seite fragt nach, bis er fertig ist
		void runEntraSync({ ausgeloest: 'hand', trotzdem }).catch((err) =>
			console.error('Entra-Abgleich fehlgeschlagen:', err)
		);
		return { bereich: 'abgleich', gestartet: true };
	},

	richtlinie: async ({ request, locals, getClientAddress }) => {
		const p = admin(locals);
		const form = await request.formData();
		const minLength = Number(form.get('mindestlaenge'));
		const resetMinutes = Number(form.get('link'));
		if (
			!PASSWORD_MIN_OPTIONS.includes(minLength as PasswordPolicy['minLength']) ||
			!RESET_MINUTES_OPTIONS.includes(resetMinutes as PasswordPolicy['resetMinutes'])
		)
			return fail(400, { bereich: 'richtlinie', fehler: 'Ungültiger Wert.' });
		const vorher = await passwordPolicy();
		const neu = normalizePolicy({ minLength, resetMinutes });
		await setSetting('password.policy', neu, p.personId);
		await log(p.personId, 'password.policy', vorher, neu, getClientAddress());
		return { bereich: 'richtlinie', gespeichert: true };
	},

	inaktivitaet: async ({ request, locals, getClientAddress }) => {
		const p = admin(locals);
		const value = String((await request.formData()).get('idle') ?? '');
		if (!Object.hasOwn(IDLE_OPTIONS, value))
			return fail(400, { bereich: 'inaktivitaet', fehler: 'Ungültiger Wert.' });
		const before = await getSetting<string>('session.idle', DEFAULT_IDLE);
		await setSetting('session.idle', value as IdleOption, p.personId);
		clearIdleCache();
		await log(p.personId, 'session.idle', before, value, getClientAddress());
		return { bereich: 'inaktivitaet', gespeichert: true };
	}
};
