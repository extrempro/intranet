/** Vorschau für Beiträge in Listen: erste Tabelle als kleine Übersicht, Lesezeit. */
import { htmlToText } from './html.ts';

/** Höchstens so viele Zeilen und Spalten zeigt die Vorschau */
const ZEILEN = 4;
const SPALTEN = 3;
const ZELLE = 28;

/**
 * Die ersten Zeilen der ersten Tabelle als reiner Text (Zellen gekürzt).
 * null, wenn es keine Tabelle mit Inhalt gibt. Das HTML ist schon bereinigt
 * gespeichert; hier wird nur Text herausgelesen, nie HTML weitergegeben.
 */
export function tabellenVorschau(html: string | null | undefined): string[][] | null {
	if (!html) return null;
	const a = html.indexOf('<table');
	if (a < 0) return null;
	const e = html.indexOf('</table>', a);
	const tabelle = html.slice(a, e < 0 ? undefined : e);
	const zeilen: string[][] = [];
	for (const tr of tabelle.split(/<tr(?=[\s>])/).slice(1)) {
		const zellen = tr
			.split(/<t[hd](?=[\s>])/)
			.slice(1)
			.slice(0, SPALTEN)
			.map((z) => {
				const t = htmlToText(`<p>${z.replace(/^[^>]*>/, '')}`);
				return t.length > ZELLE ? `${t.slice(0, ZELLE - 1)}…` : t;
			});
		if (zellen.some(Boolean)) zeilen.push(zellen);
		if (zeilen.length >= ZEILEN) break;
	}
	return zeilen.length ? zeilen : null;
}

/** Lesezeit in Minuten (200 Wörter je Minute, mindestens 1) */
export function lesezeit(text: string): number {
	const woerter = text.trim() ? text.trim().split(/\s+/).length : 0;
	return Math.max(1, Math.round(woerter / 200));
}
