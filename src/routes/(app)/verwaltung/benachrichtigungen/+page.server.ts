import { error, fail } from '@sveltejs/kit';
import { parseMailForm, smtpFehlertext, type StoredMail } from '#lib/mail-config.ts';
import { isSystemAdmin } from '#lib/server/auth/access.ts';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { audit } from '#lib/server/audit.ts';
import { encryptSecret } from '#lib/server/crypto.ts';
import {
	mailConfigured,
	mailSettings,
	resetMailTransport,
	sendMail,
	storedMail
} from '#lib/server/mail.ts';
import { pushStatus, sendToPerson, vapidKeys } from '#lib/server/push.ts';
import { setSetting } from '#lib/server/settings.ts';
import { getEntraConfig } from '#lib/server/auth/entra.ts';
import { saveTeamsSettings, teamsSettings } from '#lib/server/teams-config.ts';
import { sendTeamsTest, teamsStatus } from '#lib/server/teams.ts';
import { db } from '#lib/server/db/index.ts';
import { persons } from '#lib/server/db/schema.ts';
import { eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';

/**
 * Benachrichtigungen (Kap. 14): Web Push und E-Mail (SMTP). Den SMTP-Server
 * pflegen nur System-Admins, weil er für alle Mandanten gilt.
 */
export const load: PageServerLoad = async ({ locals }) => {
	const p = requirePrincipal(locals);
	await vapidKeys();
	const system = isSystemAdmin(p);
	// Ohne Passwort: das bleibt auf dem Server
	const { passwordEnc, ...gespeichert } = system ? await storedMail() : ({} as StoredMail);
	return {
		push: await pushStatus(),
		mail: await mailConfigured(),
		system,
		smtp: system
			? { gilt: await mailSettings(), gespeichert, passwortGespeichert: Boolean(passwordEnc) }
			: null,
		teams: system
			? {
					einstellung: await teamsSettings(),
					entra: Boolean(await getEntraConfig()),
					status: await teamsStatus(),
					microsoftKonto: Boolean(
						(
							await db
								.select({ oid: persons.entraOid })
								.from(persons)
								.where(eq(persons.id, p.personId))
						)[0]?.oid
					)
				}
			: null
	};
};

function requireSystemAdmin(locals: App.Locals) {
	const p = requirePrincipal(locals);
	if (!isSystemAdmin(p)) error(403, 'Das dürfen nur System-Admins.');
	return p;
}

export const actions: Actions = {
	test: async ({ locals }) => {
		const p = requirePrincipal(locals);
		const n = await sendToPerson(p.personId, {
			title: 'Testnachricht aus dem Intranet',
			body: 'Wenn du das liest, kommen Push-Nachrichten an.',
			link: '/verwaltung/benachrichtigungen',
			tag: 'test'
		});
		return {
			ergebnis:
				n > 0
					? `Testnachricht an ${n} ${n === 1 ? 'Gerät' : 'Geräte'} gesendet.`
					: 'Kein Gerät erreicht. Schalte Push unter Konto → Benachrichtigungen auf diesem Gerät ein.'
		};
	},

	smtp: async ({ request, locals, getClientAddress }) => {
		const p = requireSystemAdmin(locals);
		const fd = await request.formData();
		const form = Object.fromEntries(
			[...fd].filter(([k]) => k !== 'passwort').map(([k, v]) => [k, String(v).slice(0, 300)])
		);
		const { werte, fehler } = parseMailForm(form);
		if (Object.keys(fehler).length)
			return fail(400, {
				bereich: 'smtp',
				fehler: 'Bitte prüfe die markierten Felder.',
				felder: fehler,
				werte: form
			});
		const vorher = await storedMail();
		const passwort = String(fd.get('passwort') ?? '');
		let passwordEnc = vorher.passwordEnc;
		if (fd.get('passwortLoeschen') === 'on') passwordEnc = undefined;
		else if (passwort) {
			if (passwort.length > 500)
				return fail(400, { bereich: 'smtp', fehler: 'Das Passwort ist zu lang.', werte: form });
			passwordEnc = encryptSecret(new TextEncoder().encode(passwort));
		}
		const neu: StoredMail = { ...werte, ...(passwordEnc ? { passwordEnc } : {}) };
		await setSetting('mail', neu, p.personId);
		resetMailTransport();
		// Ins Protokoll ohne Passwort, nur ob es sich geändert hat
		const ohne = (s: StoredMail) => ({ ...s, passwordEnc: s.passwordEnc ? 'gesetzt' : null });
		await audit({
			category: 'admin',
			action: 'settings.update',
			actorId: p.personId,
			entityType: 'setting',
			entityId: 'mail',
			details: { vorher: ohne(vorher), nachher: ohne(neu) },
			ip: getClientAddress()
		});
		return { bereich: 'smtp', gespeichert: true };
	},

	teamsSchalten: async ({ locals, request, getClientAddress }) => {
		const p = requireSystemAdmin(locals);
		const aktiv = (await request.formData()).get('aktiv') === 'ja';
		if (aktiv && !(await getEntraConfig()))
			return fail(400, {
				bereich: 'teams',
				fehler: 'Erst die Anmeldung mit Microsoft einrichten.'
			});
		const s = await teamsSettings();
		await saveTeamsSettings({ ...s, aktiv }, p.personId);
		await audit({
			category: 'admin',
			action: 'settings.update',
			actorId: p.personId,
			entityType: 'setting',
			entityId: 'teams',
			details: { vorher: s.aktiv, nachher: aktiv },
			ip: getClientAddress()
		});
		return {
			bereich: 'teams',
			ergebnis: aktiv ? 'Teams-Benachrichtigungen sind an.' : 'Teams-Benachrichtigungen sind aus.'
		};
	},

	teamsVersion: async ({ locals, getClientAddress }) => {
		const p = requireSystemAdmin(locals);
		const s = await teamsSettings();
		await saveTeamsSettings({ ...s, version: s.version + 1 }, p.personId);
		await audit({
			category: 'admin',
			action: 'settings.update',
			actorId: p.personId,
			entityType: 'setting',
			entityId: 'teams.version',
			details: { vorher: s.version, nachher: s.version + 1 },
			ip: getClientAddress()
		});
		return {
			bereich: 'teams',
			ergebnis: `Neue Version 1.0.${s.version + 1}. Lade das Paket herunter und aktualisiere die App im Teams Admin Center.`
		};
	},

	teamsTest: async ({ locals }) => {
		const p = requireSystemAdmin(locals);
		try {
			return { bereich: 'teams', ergebnis: await sendTeamsTest(p.personId) };
		} catch (err) {
			return fail(502, { bereich: 'teams', fehler: err instanceof Error ? err.message : 'Fehler' });
		}
	},

	smtpTest: async ({ locals }) => {
		const p = requireSystemAdmin(locals);
		const [ich] = await db
			.select({ email: persons.email, name: persons.displayName })
			.from(persons)
			.where(eq(persons.id, p.personId));
		if (!(await mailConfigured()))
			return fail(400, { bereich: 'smtpTest', fehler: 'Erst SMTP-Server und Absender eintragen.' });
		try {
			await sendMail({
				to: ich.email,
				subject: 'Test-E-Mail aus dem Intranet',
				text: `Hallo ${ich.name},\n\nwenn du das liest, funktioniert der E-Mail-Versand des Intranets.`,
				html: `<p>Hallo,</p><p>wenn du das liest, funktioniert der E-Mail-Versand des Intranets.</p>`
			});
			return { bereich: 'smtpTest', ergebnis: `Test-E-Mail an ${ich.email} verschickt.` };
		} catch (err) {
			return fail(502, { bereich: 'smtpTest', fehler: smtpFehlertext(err) });
		}
	}
};
