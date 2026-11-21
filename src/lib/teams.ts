/**
 * Teams-Aktivitätsfeed (Kap. 11.1): Bausteine ohne Ein-/Ausgabe, damit testbar.
 *
 * Ein Klick auf die Benachrichtigung öffnet in Teams den Reiter der
 * Intranet-App (/teams/app): Anmeldung per SSO, dann direkt der Beitrag.
 */

/** entityId des Tabs im Manifest */
export const TEAMS_TAB_ENTITY = 'intranet';
/** entityId des vorübergehenden Test-Tabs (SSO, Cookies, Sprung aus Benachrichtigung) */
export const TEAMS_TEST_ENTITY = 'teamstest';

/** Nur eigene Pfade als Ziel (kein offener Weiterleiter) */
export function safeTabTarget(value: string | null | undefined): string {
	if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\'))
		return '/';
	return value.slice(0, 300);
}

/** Deep Link auf den Tab der App; subEntityId trägt den Pfad im Intranet */
export function teamsDeepLink(appId: string, path: string, entity = TEAMS_TAB_ENTITY): string {
	const context = JSON.stringify({ subEntityId: safeTabTarget(path) });
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
		topic: { source: 'text', value: 'Intranet', webUrl: teamsDeepLink(appId, a.link, entity) },
		activityType: 'systemDefault',
		previewText: { content: a.preview },
		templateParameters: [{ name: 'systemDefaultText', value: a.text }],
		recipients: userIds.map((userId) => ({
			'@odata.type': 'microsoft.graph.aadUserNotificationRecipient',
			userId
		}))
	};
}
