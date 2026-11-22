/**
 * „Neu im Intranet“: Einträge aus CHANGELOG.md. Überschrift je Version:
 * „## <Version> · <TT.MM.JJJJ> · <Titel>“, darunter Markdown.
 * Gleiche Regeln nutzt scripts/release-notes.mjs für die GitHub-Releases.
 */
export interface ChangelogEntry {
	version: string;
	date: string;
	title: string;
	body: string;
}

const KOPF = /^## (\d+\.\d+\.\d+) · (\d{2}\.\d{2}\.\d{4}) · (.+)$/;

/**
 * Kommentarblöcke entfernen: Zeilen von einer Zeile mit „<!--“ bis zur Zeile mit
 * „-->“ fallen ganz weg. Es werden nur ganze Zeilen weggelassen, nie Teile
 * zusammengesetzt; so kann kein neuer Kommentaranfang entstehen.
 */
export function ohneKommentare(raw: string): string {
	const behalten: string[] = [];
	let imKommentar = false;
	for (const zeile of raw.split(/\r?\n/)) {
		if (!imKommentar && zeile.includes('<!--')) imKommentar = true;
		if (!imKommentar) behalten.push(zeile);
		else if (zeile.includes('-->')) imKommentar = false;
	}
	return behalten.join('\n');
}

export function parseChangelog(raw: string): ChangelogEntry[] {
	const text = ohneKommentare(raw);
	const entries: ChangelogEntry[] = [];
	let current: ChangelogEntry | null = null;
	for (const line of text.split(/\r?\n/)) {
		const m = KOPF.exec(line.trim());
		if (m) {
			current = { version: m[1], date: m[2], title: m[3].trim(), body: '' };
			entries.push(current);
		} else if (line.startsWith('## ')) {
			current = null; // falsch formatierte Überschrift: Abschnitt nicht übernehmen
		} else if (current) {
			current.body += `${line}\n`;
		}
	}
	for (const e of entries) e.body = e.body.trim();
	return entries;
}
