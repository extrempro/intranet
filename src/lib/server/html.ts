/**
 * Bereinigt HTML aus dem Editor (Kap. 16: „HTML aus dem Editor wird bereinigt“).
 * Feste Erlaubnisliste passend zur Werkzeugleiste; alles andere fällt weg.
 */
import sanitizeHtml from 'sanitize-html';
import { BILD_KLASSEN } from '../bilder-im-text.ts';

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

/**
 * @param bilder Erlaubte Bilder im Text (Datei-IDs). Ohne Angabe fallen alle
 *   Bilder weg; erlaubt sind nur <img src="/dateien/<ID>"> aus dieser Liste,
 *   mit Beschreibung (alt) und den Klassen für Größe und Ausrichtung.
 */
export function cleanHtml(html: string, bilder?: ReadonlySet<string>): string {
	const options: sanitizeHtml.IOptions = bilder?.size
		? {
				...OPTIONS,
				allowedTags: [...(OPTIONS.allowedTags as string[]), 'img'],
				allowedAttributes: { ...OPTIONS.allowedAttributes, img: ['src', 'alt', 'class'] },
				allowedClasses: { img: BILD_KLASSEN },
				allowedSchemesAppliedToAttributes: ['href'],
				exclusiveFilter: (frame) => {
					if (frame.tag !== 'img') return false;
					const m = /^\/dateien\/([0-9a-f-]{36})$/i.exec(frame.attribs.src ?? '');
					return !m || !bilder.has(m[1].toLowerCase());
				}
			}
		: OPTIONS;
	return (
		sanitizeHtml(html, options)
			// Link ohne (sichere) Adresse: Text bleibt, Link fällt weg
			.replace(/<a>([\s\S]*?)<\/a>/g, '$1')
			// Herkunft nicht weitergeben
			.replace(/<a href="/g, '<a rel="noopener noreferrer nofollow" href="')
			.trim()
	);
}

/** Reiner Text für Suche und Vorschau. */
export function htmlToText(html: string): string {
	return sanitizeHtml(
		html.replace(/<\/(p|h2|h3|li|blockquote)>/g, '$& ').replace(/<br\s*\/?>/g, ' '),
		{
			allowedTags: [],
			allowedAttributes: {}
		}
	)
		.replace(/&nbsp;/g, ' ')
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/\s+/g, ' ')
		.trim();
}

/** Kurzer Anriss für Listen. */
export function excerpt(text: string, max = 200): string {
	if (text.length <= max) return text;
	const cut = text.slice(0, max);
	return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), max - 20)).trimEnd()} …`;
}
