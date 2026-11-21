/** Hubs (Kap. 8.12): Abschnitte der Hub-Seite und Prüfungen, auf Server und im Browser nutzbar. */
export const HUB_SECTIONS = [
	{ key: 'schnellzugriff', label: 'Schnellzugriff' },
	{ key: 'beitraege', label: 'Neues zum Thema' },
	{ key: 'termine', label: 'Termine' },
	{ key: 'dokumente', label: 'Dokumente und Anleitungen' },
	{ key: 'hubteam', label: 'Hub-Team' },
	{ key: 'ansprechpersonen', label: 'Ansprechpersonen' },
	{ key: 'faqs', label: 'Häufige Fragen' },
	{ key: 'ueber', label: 'Über uns' }
] as const;

export type HubSection = (typeof HUB_SECTIONS)[number]['key'];

/** Hauptbereich und Seitenleiste, jeweils sichtbare Abschnitte in Reihenfolge. */
export interface HubLayout {
	main: HubSection[];
	side: HubSection[];
}

export const DEFAULT_HUB_LAYOUT: HubLayout = {
	main: ['schnellzugriff', 'beitraege', 'termine', 'dokumente'],
	side: ['hubteam', 'ansprechpersonen', 'faqs', 'ueber']
};

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

const KEYS = new Set<string>(HUB_SECTIONS.map((s) => s.key));

/** Bereinigt ein gespeichertes Layout: nur bekannte Abschnitte, jeder höchstens einmal. */
export function cleanLayout(l: Partial<HubLayout> | null | undefined): HubLayout {
	if (!l) return DEFAULT_HUB_LAYOUT;
	const seen = new Set<string>();
	const pick = (list: unknown) =>
		(Array.isArray(list) ? list : []).filter(
			(k): k is HubSection => typeof k === 'string' && KEYS.has(k) && !seen.has(k) && !!seen.add(k)
		);
	return { main: pick(l.main), side: pick(l.side) };
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
