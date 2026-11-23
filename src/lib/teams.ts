/**
 * Teams-Aktivitätsfeed (Kap. 11.1): Bausteine ohne Ein-/Ausgabe, damit testbar.
 *
 * Ein Klick auf die Benachrichtigung zeigt Teams im Aktivitätsbereich an.
 * Dort steht nur ein kurzer Hinweis mit „In der Intranet-App öffnen“; der
 * Beitrag selbst öffnet sich in der App (/teams/app: Anmeldung per SSO).
 */

import { safeTarget } from './ziel.ts';

/** entityId des Tabs im Manifest */
export const TEAMS_TAB_ENTITY = 'intranet';

/** Nur eigene Pfade als Ziel (kein offener Weiterleiter) */
export function safeTabTarget(value: string | null | undefined): string {
	return safeTarget(value, 300);
}

/**
 * Vorsatz in der subEntityId für Links aus dem Aktivitätsfeed: Der Einstieg
 * zeigt dann nur den Hinweis statt des ganzen Intranets im Aktivitätsbereich.
 */
export const HINWEIS_PRAEFIX = 'hinweis:';

/** Deep Link auf den Tab der App; subEntityId trägt den Pfad im Intranet */
export function teamsDeepLink(
	appId: string,
	path: string,
	entity = TEAMS_TAB_ENTITY,
	hinweis = false
): string {
	const context = JSON.stringify({
		subEntityId: (hinweis ? HINWEIS_PRAEFIX : '') + safeTabTarget(path)
	});
	return `https://teams.microsoft.com/l/entity/${encodeURIComponent(appId)}/${entity}?context=${encodeURIComponent(context)}`;
}

export interface TeamsItem {
	title: string;
	detail: string | null;
	link: string;
}

/**
 * Inhalt einer Benachrichtigung: nur Titel, Absender und Link (Kap. 11.1).
 * Mehrere offene Meldungen einer Person (nach der Ruhezeit) werden zu einer
 * zusammengefasst.
 */
export function activityFor(items: TeamsItem[]): { preview: string; text: string; link: string } {
	if (items.length === 1) {
		const i = items[0];
		return {
			preview: i.title.slice(0, 150),
			text: (i.detail ? `${i.detail}: ${i.title}` : i.title).slice(0, 200),
			link: i.link
		};
	}
	return {
		preview: `${items.length} neue Meldungen im Intranet`,
		text: items
			.slice(0, 3)
			.map((i) => i.title)
			.join(' · ')
			.slice(0, 200),
		link: '/'
	};
}

export function activityBody(
	appId: string,
	a: ReturnType<typeof activityFor>,
	userIds: string[],
	entity = TEAMS_TAB_ENTITY
) {
	return {
		topic: {
			source: 'text',
			value: 'Intranet',
			webUrl: teamsDeepLink(appId, a.link, entity, true)
		},
		activityType: 'systemDefault',
		previewText: { content: a.preview },
		templateParameters: [{ name: 'systemDefaultText', value: a.text }],
		recipients: userIds.map((userId) => ({
			'@odata.type': 'microsoft.graph.aadUserNotificationRecipient',
			userId
		}))
	};
}
