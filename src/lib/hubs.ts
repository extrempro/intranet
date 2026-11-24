/** Hubs (Kap. 8.12): Aufbau der Hub-Seite und Prüfungen, auf Server und im Browser nutzbar. */

/** Reiter (Unterseiten) einer Hub-Seite; der Überblick steht immer vorne. */
export const HUB_REITER = [
	{ key: 'neues', label: 'Neues', pfad: 'neues' },
	{ key: 'termine', label: 'Termine', pfad: 'termine' },
	{ key: 'dokumente', label: 'Dokumente', pfad: 'dokumente' },
	{ key: 'videos', label: 'Videos', pfad: 'videos' },
	{ key: 'fragen', label: 'Fragen', pfad: 'fragen' },
	{ key: 'team', label: 'Über uns & Team', pfad: 'team' }
] as const;
export type HubReiter = (typeof HUB_REITER)[number]['key'];

/** Blöcke im Überblick (Hauptspalte); Ansprechpersonen und Videos stehen fest daneben. */
export const HUB_BLOECKE = [
	{ key: 'schnellzugriff', label: 'Schnellzugriff' },
	{ key: 'termine', label: 'Als Nächstes (die nächsten Termine)' },
	{ key: 'faqs', label: 'Häufige Fragen' },
	{ key: 'beitraege', label: 'Neues zum Thema' },
	{ key: 'dokumente', label: 'Dokumente (die ersten fünf)' }
] as const;
export type HubBlock = (typeof HUB_BLOECKE)[number]['key'];

/** Blöcke im Überblick einer Abteilung (auch Geschäftsführung, Stabsstelle): dazu „Wer hilft bei was?“ */
export const ABTEILUNG_BLOECKE = [
	{ key: 'zustaendigkeiten', label: 'Wer hilft bei was?' },
	...HUB_BLOECKE.map((b) =>
		b.key === 'beitraege' ? { key: b.key, label: 'Neues aus der Abteilung' } : b
	)
] as const;
export type SeitenBlock = HubBlock | 'zustaendigkeiten';

/** Reihenfolge der Reiter und sichtbare Blöcke im Überblick */
export interface HubLayout {
	reiter: HubReiter[];
	ueberblick: SeitenBlock[];
}

export const DEFAULT_HUB_LAYOUT: HubLayout = {
	reiter: HUB_REITER.map((r) => r.key),
	ueberblick: ['schnellzugriff', 'termine', 'faqs', 'beitraege']
};

export const DEFAULT_ABTEILUNG_LAYOUT: HubLayout = {
	reiter: HUB_REITER.map((r) => r.key),
	ueberblick: ['zustaendigkeiten', 'schnellzugriff', 'beitraege', 'termine', 'faqs']
};

/** Was eine Hub-Seite für die Reiter wissen muss */
export interface HubReiterQuelle {
	hatNeues: boolean;
	termine: number;
	dokumente: number;
	videos: number;
	fragen: number;
	team: number;
	resting: boolean;
	canPost: boolean;
	canDocs: boolean;
	canFaqs: boolean;
	canManage: boolean;
	canVideos: boolean;
	/** Termine anlegen (Abteilungen: eigenes Recht), sonst wie Beiträge */
	canEvents?: boolean;
}

export interface HubReiterStand {
	key: HubReiter;
	label: string;
	pfad: string;
	/** Zahl am Reiter, null ohne Zahl */
	anzahl: number | null;
	leer: boolean;
	/** Wer ihn füllen darf, sieht ihn auch leer */
	pflegbar: boolean;
}

/** Stand der Reiter in der eingestellten Reihenfolge. Leere Reiter sehen nur, die sie füllen dürfen. */
export function hubReiter(layout: HubLayout, q: HubReiterQuelle): HubReiterStand[] {
	const zahlen: Record<HubReiter, number | null> = {
		neues: null,
		termine: q.termine,
		dokumente: q.dokumente,
		videos: q.videos,
		fragen: q.fragen,
		team: null
	};
	const leer: Record<HubReiter, boolean> = {
		neues: !q.hatNeues,
		termine: q.termine === 0,
		dokumente: q.dokumente === 0,
		videos: q.videos === 0,
		fragen: q.fragen === 0,
		team: q.team === 0
	};
	const pflegbar: Record<HubReiter, boolean> = {
		neues: q.canPost && !q.resting,
		termine: q.canEvents ?? q.canPost,
		dokumente: q.canDocs,
		videos: q.canVideos,
		fragen: q.canFaqs,
		team: q.canManage
	};
	return layout.reiter.map((key) => {
		const r = HUB_REITER.find((x) => x.key === key)!;
		return {
			key,
			label: r.label,
			pfad: r.pfad,
			anzahl: zahlen[key] || null,
			leer: leer[key],
			pflegbar: pflegbar[key]
		};
	});
}

/** Grenzen für die Pflege eines Hubs */
export const HUB_GRENZEN = {
	kurz: 300,
	hinweis: 200,
	ansprechpersonen: 20,
	aufgabe: 120,
	links: 12,
	linkTitel: 60,
	linkBeschreibung: 80,
	linkAdresse: 1000,
	ordner: 30,
	ordnerName: 80,
	dokumente: 300,
	dokumentTitel: 200,
	dokumentBeschreibung: 500
} as const;

/** Symbole für den Schnellzugriff (Linien-Symbole, 24×24) */
export const LINK_SYMBOLE = {
	link: {
		name: 'Link',
		d: 'M9 15l6 -6M11 6l.463 -.536a5 5 0 0 1 7.071 7.072l-.534 .464M13 18l-.397 .534a5.068 5.068 0 0 1 -7.127 0a4.972 4.972 0 0 1 0 -7.071l.524 -.463'
	},
	dokument: {
		name: 'Dokument',
		d: 'M14 3v4a1 1 0 0 0 1 1h4M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2zM9 9h1M9 13h6M9 17h6'
	},
	formular: {
		name: 'Formular',
		d: 'M9 5h-2a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-12a2 2 0 0 0 -2 -2h-2M9 3m0 2a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v0a2 2 0 0 1 -2 2h-2a2 2 0 0 1 -2 -2zM9 12l2 2l4 -4'
	},
	kalender: {
		name: 'Kalender',
		d: 'M4 7a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2zM16 3v4M8 3v4M4 11h16'
	},
	chat: {
		name: 'Chat / Teams',
		d: 'M8 9h8M8 13h6M18 4a3 3 0 0 1 3 3v8a3 3 0 0 1 -3 3h-5l-5 3v-3h-2a3 3 0 0 1 -3 -3v-8a3 3 0 0 1 3 -3h12z'
	},
	ordner: {
		name: 'Ordner',
		d: 'M5 4h4l3 3h7a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-11a2 2 0 0 1 2 -2'
	},
	video: {
		name: 'Video',
		d: 'M15 10l4.553 -2.276a1 1 0 0 1 1.447 .894v6.764a1 1 0 0 1 -1.447 .894l-4.553 -2.276v-4zM3 6m0 2a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-8a2 2 0 0 1 -2 -2z'
	},
	mail: {
		name: 'E-Mail',
		d: 'M3 7a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-10zM3 7l9 6l9 -6'
	},
	info: { name: 'Info', d: 'M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0M12 9h.01M11 12h1v4h1' },
	stern: {
		name: 'Stern',
		d: 'M12 17.75l-6.172 3.245l1.179 -6.873l-5 -4.867l6.9 -1l3.086 -6.253l3.086 6.253l6.9 1l-5 4.867l1.179 6.873z'
	},
	musik: {
		name: 'Musik',
		d: 'M3 17a3 3 0 1 0 6 0a3 3 0 0 0 -6 0M13 17a3 3 0 1 0 6 0a3 3 0 0 0 -6 0M9 17v-13h10v13M9 8h10'
	},
	welt: {
		name: 'Webseite',
		d: 'M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0M3.6 9h16.8M3.6 15h16.8M11.5 3a17 17 0 0 0 0 18M12.5 3a17 17 0 0 1 0 18'
	}
} as const;
export type LinkSymbol = keyof typeof LINK_SYMBOLE;
export const istLinkSymbol = (x: string): x is LinkSymbol => x in LINK_SYMBOLE;

/**
 * Adresse für den Schnellzugriff: https, mailto, tel oder ein Pfad im Intranet.
 * Liefert die bereinigte Adresse oder null.
 */
export function linkAdresse(roh: string): string | null {
	const a = roh.trim();
	if (!a || a.length > HUB_GRENZEN.linkAdresse || /\s/.test(a)) return null;
	if (a.startsWith('/')) return /^\/(?![/\\])/.test(a) ? a : null;
	if (/^mailto:[^\s@]+@[^\s@]+$/i.test(a) || /^tel:\+?[0-9 ()/-]{3,30}$/i.test(a)) return a;
	const mitSchema = /^[a-z][a-z0-9+.-]*:/i.test(a) ? a : `https://${a}`;
	try {
		const u = new URL(mitSchema);
		return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : null;
	} catch {
		return null;
	}
}

const REITER = new Set<string>(HUB_REITER.map((r) => r.key));
const BLOECKE = new Set<string>(HUB_BLOECKE.map((b) => b.key));
const ABT_BLOECKE = new Set<string>(ABTEILUNG_BLOECKE.map((b) => b.key));

function eindeutig<T extends string>(list: unknown, erlaubt: Set<string>): T[] {
	const seen = new Set<string>();
	return (Array.isArray(list) ? list : []).filter(
		(k): k is T => typeof k === 'string' && erlaubt.has(k) && !seen.has(k) && !!seen.add(k)
	);
}

/**
 * Bereinigt einen gespeicherten Aufbau: Reiter immer vollständig (fehlende hinten),
 * Blöcke nur bekannte, jeder höchstens einmal. Ältere Aufbauten mit Haupt- und
 * Seitenbereich werden übernommen: Was dort sichtbar war, bleibt im Überblick.
 */
export function cleanLayout(l: unknown, art: 'hub' | 'abteilung' = 'hub'): HubLayout {
	const standard = art === 'hub' ? DEFAULT_HUB_LAYOUT : DEFAULT_ABTEILUNG_LAYOUT;
	if (!l || typeof l !== 'object') return standard;
	const o = l as Record<string, unknown>;
	if (!('reiter' in o) && !('ueberblick' in o) && ('main' in o || 'side' in o)) {
		const alt = new Set([
			...(Array.isArray(o.main) ? o.main : []),
			...(Array.isArray(o.side) ? o.side : [])
		]);
		return {
			reiter: standard.reiter,
			ueberblick: standard.ueberblick.filter((k) => alt.has(k))
		};
	}
	const reiter = eindeutig<HubReiter>(o.reiter, REITER);
	for (const r of standard.reiter) if (!reiter.includes(r)) reiter.push(r);
	return {
		reiter,
		ueberblick: eindeutig<SeitenBlock>(o.ueberblick, art === 'hub' ? BLOECKE : ABT_BLOECKE)
	};
}

export interface HubApplicationInput {
	name: string;
	description: string;
	reason: string;
	team: string;
	central: boolean;
}

export type HubApplicationErrors = Partial<Record<keyof HubApplicationInput, string>>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Teamliste aus Freitext (Komma, Semikolon, Zeilen) */
export function parseTeam(text: string): string[] {
	return [
		...new Set(
			text
				.split(/[\s,;]+/)
				.map((s) => s.trim().toLowerCase())
				.filter(Boolean)
		)
	];
}

export function validateApplication(i: HubApplicationInput): HubApplicationErrors {
	const e: HubApplicationErrors = {};
	const name = i.name.trim();
	if (name.length < 3) e.name = 'Gib bitte einen Namen an.';
	else if (name.length > 80) e.name = 'Höchstens 80 Zeichen.';
	if (i.description.trim().length < 10)
		e.description = 'Beschreib bitte kurz, worum es im Hub geht.';
	else if (i.description.trim().length > 1000) e.description = 'Höchstens 1000 Zeichen.';
	if (i.reason.trim().length < 10) e.reason = 'Begründe bitte kurz, warum es den Hub braucht.';
	else if (i.reason.trim().length > 1000) e.reason = 'Höchstens 1000 Zeichen.';
	const team = parseTeam(i.team);
	if (team.length === 0) e.team = 'Gib bitte mindestens eine E-Mail-Adresse für das Hub-Team an.';
	else if (team.length > 10) e.team = 'Höchstens 10 Personen im Hub-Team.';
	else if (team.some((m) => !EMAIL.test(m)))
		e.team = 'Bitte nur E-Mail-Adressen, getrennt durch Komma.';
	return e;
}
