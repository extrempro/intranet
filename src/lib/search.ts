/**
 * Globale Suche (Kap. 8.14): Suchbegriff → sichere tsquery, Trefferarten
 * und Hervorhebungen. Rein und getestet; die Abfragen stehen in server/search.ts.
 */

export const SEARCH_KINDS = [
	{ key: 'personen', label: 'Personen' },
	{ key: 'einheiten', label: 'Abteilungen' },
	{ key: 'zustaendigkeiten', label: 'Zuständigkeiten' },
	{ key: 'beitraege', label: 'Beiträge' },
	{ key: 'faqs', label: 'FAQs' },
	{ key: 'rechtliches', label: 'Rechtliches' },
	{ key: 'termine', label: 'Termine' },
	{ key: 'hubs', label: 'Hubs' },
	{ key: 'brett', label: 'Schwarzes Brett' },
	{ key: 'kulissen', label: 'Hinter den Kulissen' }
] as const;

export type SearchKind = (typeof SEARCH_KINDS)[number]['key'];

export function isSearchKind(k: string | null | undefined): k is SearchKind {
	return SEARCH_KINDS.some((x) => x.key === k);
}

export const QUERY_MAX = 100;

/** Wörter aus der Eingabe: nur Buchstaben und Ziffern, höchstens 6. */
export function searchTerms(q: string): string[] {
	return (
		q
			.slice(0, QUERY_MAX)
			.normalize('NFC')
			.match(/[\p{L}\p{N}]+/gu) ?? []
	)
		.map((t) => t.slice(0, 40))
		.slice(0, 6);
}

/**
 * tsquery mit Präfixsuche je Wort („antr urlaub“ → „antr:* & urlaub:*“).
 * Da nur Buchstaben und Ziffern übrig bleiben, ist kein Operator einschleusbar.
 */
export function toTsQuery(q: string): string | null {
	const terms = searchTerms(q);
	return terms.length ? terms.map((t) => `${t}:*`).join(' & ') : null;
}

/** Marken für Hervorhebungen aus ts_headline (Steuerzeichen, kommen in Texten nicht vor). */
export const MARK_START = '\u0001';
export const MARK_END = '\u0002';

export interface Segment {
	text: string;
	mark: boolean;
}

/** Text mit Marken in Abschnitte zerlegen; die Darstellung escapt Svelte selbst. */
export function splitMarks(s: string): Segment[] {
	const out: Segment[] = [];
	let mark = false;
	let buf = '';
	for (const ch of s) {
		if (ch === MARK_START || ch === MARK_END) {
			if (buf) out.push({ text: buf, mark });
			buf = '';
			mark = ch === MARK_START;
		} else buf += ch;
	}
	if (buf) out.push({ text: buf, mark });
	return out;
}
