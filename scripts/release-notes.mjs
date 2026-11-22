// Text eines GitHub-Release aus CHANGELOG.md (Aufruf in .github/workflows/release.yml).
//   node scripts/release-notes.mjs <Version>          → Stichpunkte (Markdown)
//   node scripts/release-notes.mjs <Version> --titel  → Titel des Eintrags
// Format wie in src/lib/changelog.ts: „## <Version> · <TT.MM.JJJJ> · <Titel>“.
import { readFileSync } from 'node:fs';

const [version, option] = process.argv.slice(2);
// Kommentare entfernen, bis keiner mehr übrig ist (wie ohneKommentare in src/lib/changelog.ts)
let text = readFileSync('CHANGELOG.md', 'utf8');
for (
	let weiter = text.replace(/<!--[\s\S]*?-->/g, '');
	weiter !== text;
	weiter = text.replace(/<!--[\s\S]*?-->/g, '')
)
	text = weiter;
text = text.replace(/<!--/g, '');
const kopf = /^## (\d+\.\d+\.\d+) · (\d{2}\.\d{2}\.\d{4}) · (.+)$/;
let gefunden = null;
const zeilen = [];
for (const zeile of text.split(/\r?\n/)) {
	const m = kopf.exec(zeile.trim());
	if (m || zeile.startsWith('## ')) {
		if (gefunden) break;
		if (m && m[1] === version) gefunden = { datum: m[2], titel: m[3].trim() };
		continue;
	}
	if (gefunden) zeilen.push(zeile);
}
if (!gefunden) {
	console.error(`Kein Eintrag für Version ${version} in CHANGELOG.md`);
	process.exit(1);
}
console.log(option === '--titel' ? gefunden.titel : `${zeilen.join('\n').trim()}\n`);
