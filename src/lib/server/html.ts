/**
 * Bereinigt HTML aus dem Editor (Kap. 16: „HTML aus dem Editor wird bereinigt“).
 * Feste Erlaubnisliste passend zur Werkzeugleiste; alles andere fällt weg.
 */
import sanitizeHtml from 'sanitize-html';
import { BILD_KLASSEN } from '../bilder-im-text.ts';
import { KASTEN_KLASSEN } from '../textbausteine.ts';

const OPTIONS: sanitizeHtml.IOptions = {
	allowedTags: [
		'p',
		'br',
		'strong',
		'em',
		'u',
		's',
		'h2',
		'h3',
		'ul',
		'ol',
		'li',
		'blockquote',
		'a',
		'hr'
	],
	allowedAttributes: { a: ['href'] },
	allowedSchemes: ['https', 'http', 'mailto', 'tel'],
	allowedSchemesAppliedToAttributes: ['href'],
	allowProtocolRelative: false,
	transformTags: {
		b: 'strong',
		i: 'em',
		h1: 'h2',
		h4: 'h3',
		h5: 'h3',
		h6: 'h3'
	}
};

const TABELLE = ['table', 'thead', 'tbody', 'tr', 'th', 'td'];

export type HtmlOptionen = {
	/**
	 * Erlaubte Bilder im Text (Datei-IDs). Ohne Angabe fallen alle Bilder weg;
	 * erlaubt sind nur <img src="/dateien/<ID>"> aus dieser Liste, mit
	 * Beschreibung (alt) und den Klassen für Größe und Ausrichtung.
	 */
	bilder?: ReadonlySet<string>;
	/** Tabellen (ohne verbundene Zellen) und Infokästen erlauben */
	erweitert?: boolean;
};

export function cleanHtml(html: string, { bilder, erweitert }: HtmlOptionen = {}): string {
	const tags = [...(OPTIONS.allowedTags as string[])];
	const attribute: Record<string, string[]> = { a: ['href'] };
	const klassen: Record<string, string[]> = {};
	if (erweitert) {
		tags.push(...TABELLE, 'div');
		attribute.div = ['class'];
		klassen.div = KASTEN_KLASSEN;
	}
	const mitBildern = Boolean(bilder?.size);
	if (mitBildern) {
		tags.push('img');
		attribute.img = ['src', 'alt', 'class'];
		klassen.img = BILD_KLASSEN;
	}
	const options: sanitizeHtml.IOptions = {
		...OPTIONS,
		allowedTags: tags,
		allowedAttributes: attribute,
		allowedClasses: klassen,
		exclusiveFilter: (frame) => {
			// Bilder nur aus der Liste erlaubter Dateien
			if (frame.tag !== 'img') return false;
			const m = /^\/dateien\/([0-9a-f-]{36})$/i.exec(frame.attribs.src ?? '');
			return !mitBildern || !m || !bilder!.has(m[1].toLowerCase());
		}
	};
	return (
		sanitizeHtml(html, options)
			// Link ohne (sichere) Adresse: Text bleibt, Link fällt weg
			.replace(/<a>([\s\S]*?)<\/a>/g, '$1')
			// Herkunft nicht weitergeben
			.replace(/<a href="/g, '<a rel="noopener noreferrer nofollow" href="')
			.trim()
	);
}

const ENTITAETEN: Record<string, string> = {
	nbsp: ' ',
	amp: '&',
	lt: '<',
	gt: '>',
	quot: '"',
	'#39': "'"
};

/** Reiner Text für Suche und Vorschau. */
export function htmlToText(html: string): string {
	return (
		sanitizeHtml(
			html.replace(/<\/(p|h2|h3|li|blockquote|td|th|div)>/g, '$& ').replace(/<br\s*\/?>/g, ' '),
			{
				allowedTags: [],
				allowedAttributes: {}
			}
		)
			// In einem Durchgang, sonst würde aus „&amp;lt;“ ein „<“
			.replace(/&(nbsp|amp|lt|gt|quot|#39);/g, (_, e: string) => ENTITAETEN[e])
			.replace(/\s+/g, ' ')
			.trim()
	);
}

/** Kurzer Anriss für Listen. */
export function excerpt(text: string, max = 200): string {
	if (text.length <= max) return text;
	const cut = text.slice(0, max);
	return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), max - 20)).trimEnd()} …`;
}
