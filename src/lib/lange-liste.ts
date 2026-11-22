/**
 * Lange Listen (Kap. 6.7): Anzahl aus der Adresse, Monatsgruppen,
 * Texte für Zähler und „ältere laden“.
 */
import { monthLabel } from './calendar.ts';
import { ZONE } from './news.ts';

/** Liest `?anzahl=` als Vielfaches von `schritt`, mindestens `schritt`, höchstens `max`. */
export function anzahlAus(url: URL, schritt: number, max: number): number {
	const n = Number.parseInt(url.searchParams.get('anzahl') ?? '', 10);
	if (!Number.isFinite(n) || n <= schritt) return schritt;
	return Math.min(Math.ceil(n / schritt) * schritt, Math.max(schritt, max));
}

const fmtMonat = new Intl.DateTimeFormat('en-CA', {
	timeZone: ZONE,
	year: 'numeric',
	month: '2-digit'
});

/** „2026-11“ in Europe/Berlin */
export function monatVon(d: Date): string {
	return fmtMonat.format(d).slice(0, 7);
}

export interface Monatsgruppe<T> {
	monat: string;
	titel: string;
	/** Anzahl im ganzen Monat (nicht nur geladen) */
	anzahl: number;
	eintraege: T[];
}

/** Geladene Einträge (neueste zuerst) nach Monat gruppieren. */
export function nachMonat<T>(
	eintraege: T[],
	datum: (e: T) => Date,
	jeMonat: { monat: string; n: number }[] = []
): Monatsgruppe<T>[] {
	const zahl = new Map(jeMonat.map((m) => [m.monat, m.n]));
	const gruppen: Monatsgruppe<T>[] = [];
	for (const e of eintraege) {
		const monat = monatVon(datum(e));
		let g = gruppen.at(-1);
		if (!g || g.monat !== monat) {
			g = { monat, titel: monthLabel(monat), anzahl: 0, eintraege: [] };
			gruppen.push(g);
		}
		g.eintraege.push(e);
	}
	for (const g of gruppen) g.anzahl = zahl.get(g.monat) ?? g.eintraege.length;
	return gruppen;
}

/** „1 Beitrag“ / „3 Beiträge“ */
export function mitZahl(n: number, eins: string, mehr: string): string {
	return `${n} ${n === 1 ? eins : mehr}`;
}
