import {
	CHANNELS,
	TOPICS,
	type Channel,
	type EmailMode,
	type TopicDefinition
} from '#lib/notify.ts';
import { canSeeAdministration, isSystemAdmin, type Principal } from '#lib/server/auth/access.ts';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { mailConfigured } from '#lib/server/mail.ts';
import { getNotify, setNotify } from '#lib/server/notify.ts';
import { listDevices, removeDevice, vapidKeys } from '#lib/server/push.ts';
import type { Actions, PageServerLoad } from './$types';

/** Themen nur für bestimmte Aufgaben (Moderation, Pflege einer Einheit) */
function allowed(p: Principal, onlyFor: TopicDefinition['onlyFor']) {
	if (!onlyFor) return true;
	if (onlyFor === 'system') return isSystemAdmin(p);
	if (onlyFor === 'moderation') return p.roles.some((r) => r.role === 'moderation_schwarzes_brett');
	if (onlyFor === 'verwaltung') return canSeeAdministration(p);
	return p.roles.some((r) => r.role === 'abteilungsverwaltung' || r.role === 'redaktion');
}

const FIELD: Record<Channel, string> = { bell: 'glocke', push: 'push', email: 'mail' };

export const load: PageServerLoad = async ({ locals }) => {
	const p = requirePrincipal(locals);
	const [einstellung, mailBereit, geraete, keys] = await Promise.all([
		getNotify(p.personId),
		mailConfigured(),
		listDevices(p),
		vapidKeys()
	]);
	return {
		einstellung,
		mailBereit,
		geraete: geraete.map((g) => ({
			id: g.id,
			label: g.label,
			endpoint: g.endpoint,
			createdAt: g.createdAt,
			lastSuccessAt: g.lastSuccessAt
		})),
		vapidKey: keys.publicKey,
		themen: TOPICS.filter((t) => !t.hidden)
			.filter((t) => allowed(p, t.onlyFor))
			.map((t) => t.key)
	};
};

export const actions: Actions = {
	speichern: async ({ request, locals }) => {
		const p = requirePrincipal(locals);
		const f = await request.formData();
		const topics: Record<string, Record<Channel, boolean>> = {};
		const vorher = await getNotify(p.personId);
		for (const t of TOPICS)
			// Nicht angezeigte Themen behalten ihre bisherige Einstellung
			topics[t.key] =
				t.hidden || !allowed(p, t.onlyFor)
					? vorher.topics[t.key]
					: (Object.fromEntries(
							CHANNELS.map((c) => [c, f.get(`${t.key}_${FIELD[c]}`) === 'on'])
						) as Record<Channel, boolean>);
		const zeit = (k: string) => String(f.get(k) ?? '').slice(0, 5);
		await setNotify(p.personId, {
			topics,
			emailMode: String(f.get('modus') ?? 'taeglich') as EmailMode,
			quiet: {
				on: f.get('ruhe') === 'on',
				start: zeit('ruhe_von'),
				end: zeit('ruhe_bis'),
				weekend: f.get('ruhe_wochenende') === 'on',
				urgent: f.get('ruhe_dringend') === 'on'
			}
		});
		return { gespeichert: true };
	},
	geraetEntfernen: async ({ request, locals }) => {
		await removeDevice(
			requirePrincipal(locals),
			String((await request.formData()).get('id') ?? '')
		);
		return { entfernt: true };
	}
};
