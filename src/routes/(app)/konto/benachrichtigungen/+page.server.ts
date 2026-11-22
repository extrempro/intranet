import { fail } from '@sveltejs/kit';
import { berlinNow } from '#lib/canteen.ts';
import {
	CHANNELS,
	resolveAbsence,
	TOPICS,
	WOCHENTAGE,
	type Channel,
	type EmailMode,
	type QuietArt,
	type TopicChannels
} from '#lib/notify.ts';
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
				days: WOCHENTAGE.map((_, i) => ({
					art: String(f.get(`tag${i}_art`) ?? '') as QuietArt,
					start: zeit(`tag${i}_von`),
					end: zeit(`tag${i}_bis`)
				})),
				urgent: f.get('ruhe_dringend') === 'on'
			},
			// Abwesenheit hat ein eigenes Formular und bleibt hier unverändert
			absence: vorher.absence
		});
		return { bereich: 'benachrichtigungen', gespeichert: true };
	},
	abwesenheit: async ({ request, locals }) => {
		const p = requirePrincipal(locals);
		const f = await request.formData();
		const vorher = await getNotify(p.personId);
		if (f.get('beenden') === '1') {
			await setNotify(p.personId, { ...vorher, absence: null });
			return { bereich: 'abwesenheit', ergebnis: 'Abwesenheit beendet.' };
		}
		const absence = resolveAbsence({
			from: String(f.get('abw_von') ?? ''),
			to: String(f.get('abw_bis') ?? ''),
			urgent: f.get('abw_dringend') === 'on'
		});
		if (!absence)
			return fail(400, {
				bereich: 'abwesenheit',
				fehler: 'Bitte prüfe die Tage: „bis“ darf nicht vor „von“ liegen, höchstens ein Jahr.'
			});
		if (absence.to < berlinNow().date)
			return fail(400, {
				bereich: 'abwesenheit',
				fehler: 'Der Zeitraum liegt in der Vergangenheit.'
			});
		await setNotify(p.personId, { ...vorher, absence });
		return { bereich: 'abwesenheit', ergebnis: 'Abwesenheit gespeichert.' };
	},
	geraetEntfernen: async ({ request, locals }) => {
		await removeDevice(
			requirePrincipal(locals),
			String((await request.formData()).get('id') ?? '')
		);
		return { bereich: 'benachrichtigungen', entfernt: true };
	}
};
