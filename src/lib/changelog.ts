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

export function parseChangelog(raw: string): ChangelogEntry[] {
	const text = raw.replace(/<!--[\s\S]*?-->/g, '');
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
