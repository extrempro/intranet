/** Hub-Seite: Reiter-Stand aus den Daten des Layouts berechnen (Kopf, Überblick, Unterseiten). */
import { hubReiter, type HubLayout, type HubReiter, type HubReiterStand } from './hubs.ts';

interface Daten {
	hub: {
		layout: HubLayout;
		termine: unknown[];
		dokumente: unknown[];
		faqs: unknown[];
		team: unknown[];
		kontakte: unknown[];
		aboutHtml: string | null;
		resting: Date | string | null;
		canPost: boolean;
		canDocs: boolean;
		canFaqs: boolean;
		canManage: boolean;
	};
	hatNeues: boolean;
	mediathek: { videos: unknown[]; darf: boolean };
}

export function reiterStand(d: Daten): HubReiterStand[] {
	const h = d.hub;
	return hubReiter(h.layout, {
		hatNeues: d.hatNeues,
		termine: h.termine.length,
		dokumente: h.dokumente.length,
		videos: d.mediathek.videos.length,
		fragen: h.faqs.length,
		team: h.team.length + h.kontakte.length + (h.aboutHtml ? 1 : 0),
		resting: Boolean(h.resting),
		canPost: h.canPost,
		canDocs: h.canDocs,
		canFaqs: h.canFaqs,
		canManage: h.canManage,
		canVideos: d.mediathek.darf
	});
}

export function reiterVon(d: Daten, key: HubReiter): HubReiterStand {
	return reiterStand(d).find((r) => r.key === key)!;
}
