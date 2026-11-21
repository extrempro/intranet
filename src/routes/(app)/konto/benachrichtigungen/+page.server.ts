import { CHANNELS, TOPICS, type Channel, type EmailMode, type TopicChannels } from '#lib/notify.ts';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { benachrichtigungsDaten, teamsFor, topicAllowed } from '#lib/server/konto.ts';
import { getNotify, setNotify } from '#lib/server/notify.ts';
import { removeDevice } from '#lib/server/push.ts';
import type { Actions, PageServerLoad } from './$types';

const FIELD: Record<Channel, string> = { bell: 'glocke', push: 'push', email: 'mail' };

export const load: PageServerLoad = async ({ locals }) =>
	benachrichtigungsDaten(requirePrincipal(locals));

export const actions: Actions = {
	speichern: async ({ request, locals }) => {
		const p = requirePrincipal(locals);
		const f = await request.formData();
		const topics: Record<string, TopicChannels> = {};
		const vorher = await getNotify(p.personId);
		const teams = await teamsFor(p);
		for (const t of TOPICS)
			// Nicht angezeigte Themen behalten ihre bisherige Einstellung
			topics[t.key] =
				t.hidden || !topicAllowed(p, t.onlyFor)
					? vorher.topics[t.key]
					: {
							...(Object.fromEntries(
								CHANNELS.map((c) => [c, f.get(`${t.key}_${FIELD[c]}`) === 'on'])
							) as Record<Channel, boolean>),
							// Teams nur ändern, wenn die Spalte angezeigt wurde
							teams: teams ? f.get(`${t.key}_teams`) === 'on' : vorher.topics[t.key].teams
						};
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
		return { bereich: 'benachrichtigungen', gespeichert: true };
	},
	geraetEntfernen: async ({ request, locals }) => {
		await removeDevice(
			requirePrincipal(locals),
			String((await request.formData()).get('id') ?? '')
		);
		return { bereich: 'benachrichtigungen', entfernt: true };
	}
};
