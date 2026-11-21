/** „Neu im Intranet“ (CHANGELOG.md, mit der Version ausgeliefert), HTML bereinigt. */
import { marked } from 'marked';
import raw from '../../../CHANGELOG.md?raw';
import { parseChangelog } from '../changelog.ts';
import { cleanHtml } from './html.ts';

const entries = parseChangelog(raw).map((e) => ({
	...e,
	html: cleanHtml(marked.parse(e.body, { async: false, gfm: true }))
}));

/** Aktuelle Version: der neueste Eintrag (ein Test prüft: gleich package.json). */
export const APP_VERSION = entries[0]?.version ?? '0.0.0';

export function releaseNotes() {
	return entries;
}
