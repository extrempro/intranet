/**
 * Volltext-Bausteine (Kap. 8.14). Die Dokument-Ausdrücke müssen genau den
 * Ausdrucksindizes in drizzle/0017_suche.sql entsprechen, sonst nutzt
 * PostgreSQL die Indizes nicht. Die Konfiguration steht deshalb fest im SQL.
 */
import { sql, type SQL } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { MARK_END, MARK_START } from '../search.ts';

type Expr = AnyPgColumn | SQL;

/** Titel (Gewicht A) und Text (Gewicht B) als tsvector. */
export function doc(title: Expr, body: Expr): SQL {
	return sql`(setweight(to_tsvector('intranet_de', ${title}), 'A') || setweight(to_tsvector('intranet_de', ${body}), 'B'))`;
}

export function query(tsq: string): SQL {
	return sql`to_tsquery('intranet_de', ${tsq})`;
}

export function matches(document: SQL, tsq: string): SQL {
	return sql`${document} @@ ${query(tsq)}`;
}

export function rank(document: SQL, tsq: string): SQL<number> {
	return sql<number>`ts_rank(${document}, ${query(tsq)})`;
}

/** Ausschnitt mit Marken um die Treffer (Darstellung: splitMarks). */
export function headline(text: Expr, tsq: string): SQL<string> {
	const opts = `StartSel=${MARK_START}, StopSel=${MARK_END}, MaxWords=28, MinWords=12, ShortWord=2, MaxFragments=1, FragmentDelimiter=" … "`;
	return sql<string>`ts_headline('intranet_de', left(${text}, 5000), ${query(tsq)}, ${opts})`;
}
