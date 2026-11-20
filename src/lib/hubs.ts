/** Hubs (Kap. 8.12): Abschnitte der Hub-Seite und Prüfungen, auf Server und im Browser nutzbar. */
export const HUB_SECTIONS = [
	{ key: 'hinweis', label: 'Hinweis oben' },
	{ key: 'beitraege', label: 'Beiträge' },
	{ key: 'termine', label: 'Termine' },
	{ key: 'ansprechpersonen', label: 'Ansprechpersonen' },
	{ key: 'ueber', label: 'Über uns' }
] as const;

export type HubSection = (typeof HUB_SECTIONS)[number]['key'];

/** Hauptbereich und Seitenleiste, jeweils sichtbare Abschnitte in Reihenfolge. */
export interface HubLayout {
	main: HubSection[];
	side: HubSection[];
}

export const DEFAULT_HUB_LAYOUT: HubLayout = {
	main: ['hinweis', 'beitraege'],
	side: ['termine', 'ansprechpersonen', 'ueber']
};

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
