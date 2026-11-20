/**
 * Handbuch (Kap. 13): Kapitel, Rollen und das Lesen der Artikel-Kopfzeilen.
 * Die Artikel liegen als Markdown in src/lib/handbuch und werden mit jeder
 * Änderung im Code mitgepflegt (Grundprinzip 6).
 */
export const HANDBOOK_CHAPTERS = [
	{ key: 'grundlagen', label: 'Grundlagen' },
	{ key: 'erstellen', label: 'Erstellen' },
	{ key: 'pflegen', label: 'Pflegen' },
	{ key: 'verwaltung', label: 'Verwaltung' }
] as const;
export type HandbookChapter = (typeof HANDBOOK_CHAPTERS)[number]['key'];

/** Für wen ein Artikel gedacht ist. */
export const HANDBOOK_ROLES = {
	alle: 'Alle',
	schreiben: 'Mit Schreibrecht',
	abteilungsverwaltung: 'Abteilungsverwaltung',
	hub_team: 'Hub-Team',
	redaktion: 'Redaktion',
	moderation: 'Moderation Schwarzes Brett',
	fachpflege: 'Fachpflege (Pläne)',
	vereinbarungen: 'Vereinbarungen pflegen',
	organigramm: 'Organigramm pflegen',
	verwaltung: 'Verwaltung'
} as const;
export type HandbookRole = keyof typeof HANDBOOK_ROLES;

export interface HandbookMeta {
	slug: string;
	title: string;
	chapter: HandbookChapter;
	roles: HandbookRole[];
	order: number;
	summary: string;
}

/** Kopfzeilen zwischen „---“ lesen (einfaches „schlüssel: wert“). */
export function parseArticle(slug: string, raw: string): { meta: HandbookMeta; body: string } {
	const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(raw.replace(/\r\n/g, '\n'));
	if (!m) throw new Error(`Handbuch: Kopfzeilen fehlen in ${slug}`);
	const fields = Object.fromEntries(
		m[1].split('\n').map((line) => {
			const i = line.indexOf(':');
			return [line.slice(0, i).trim(), line.slice(i + 1).trim()];
		})
	);
	const chapter = fields.kapitel as HandbookChapter;
	if (!HANDBOOK_CHAPTERS.some((c) => c.key === chapter))
		throw new Error(`Handbuch: unbekanntes Kapitel in ${slug}`);
	const roles = (fields.rollen ?? 'alle')
		.split(',')
		.map((r: string) => r.trim())
		.filter(Boolean) as HandbookRole[];
	if (!roles.length || roles.some((r) => !(r in HANDBOOK_ROLES)))
		throw new Error(`Handbuch: unbekannte Rolle in ${slug}`);
	if (!fields.titel) throw new Error(`Handbuch: Titel fehlt in ${slug}`);
	return {
		meta: {
			slug,
			title: fields.titel,
			chapter,
			roles,
			order: Number(fields.reihenfolge ?? 99) || 99,
			summary: fields.kurz ?? ''
		},
		body: m[2].trim()
	};
}

/** Passt der Artikel zu den Rollen der Person? */
export function fitsRoles(meta: HandbookMeta, mine: Set<HandbookRole>): boolean {
	return meta.roles.includes('alle') || meta.roles.some((r) => mine.has(r));
}
