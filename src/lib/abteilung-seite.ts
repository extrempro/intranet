/** Abteilungsseite (Kap. 8.11): Reiter wie bei Hubs aus den Daten der Seite berechnen. */
import { hubReiter, type HubLayout, type HubReiter, type HubReiterStand } from './hubs.ts';

interface Daten {
	einheit: {
		layout: HubLayout;
		termine: unknown[];
		dokumente: unknown[];
		faqs: unknown[];
		team: unknown[];
		about: string | null;
		canPost: boolean;
		canEvents: boolean;
		canDocs: boolean;
		canFaqs: boolean;
		canManage: boolean;
		canAdminister: boolean;
	};
	hatNeues: boolean;
	mediathek: { videos: unknown[]; darf: boolean };
}

export function abteilungReiter(d: Daten): HubReiterStand[] {
	const e = d.einheit;
	return hubReiter(e.layout, {
		hatNeues: d.hatNeues,
		termine: e.termine.length,
		dokumente: e.dokumente.length,
		videos: d.mediathek.videos.length,
		fragen: e.faqs.length,
		team: e.team.length + (e.about ? 1 : 0),
		resting: false,
		canPost: e.canPost,
		canEvents: e.canEvents,
		canDocs: e.canDocs,
		canFaqs: e.canFaqs,
		canManage: e.canManage || e.canAdminister,
		canVideos: d.mediathek.darf
	});
}

export function abteilungReiterVon(d: Daten, key: HubReiter): HubReiterStand {
	return abteilungReiter(d).find((r) => r.key === key)!;
}
