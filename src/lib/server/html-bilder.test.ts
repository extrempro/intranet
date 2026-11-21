import { describe, expect, it } from 'vitest';
import { alleBilderBeschrieben, bildIdsImText } from '../bilder-im-text.ts';
import { cleanHtml, htmlToText } from './html.ts';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';

describe('Bilder im Text', () => {
	const html = `<p>Hallo</p><img src="/dateien/${A}" alt="Chor" class="bild-mittel bild-links evil" onerror="x()" width="9"><img src="/dateien/${B}" alt="fremd"><img src="https://boese.example/x.png" alt="x"><img src="data:image/png;base64,AA" alt="y">`;

	it('ohne Erlaubnis fallen alle Bilder weg', () => {
		expect(cleanHtml(html)).toBe('<p>Hallo</p>');
	});

	it('nur erlaubte eigene Bilder, nur bekannte Klassen und Attribute', () => {
		const out = cleanHtml(html, { bilder: new Set([A]) });
		expect(out).toBe(
			`<p>Hallo</p><img src="/dateien/${A}" alt="Chor" class="bild-mittel bild-links" />`
		);
		expect(bildIdsImText(out)).toEqual([A]);
	});

	it('erkennt fehlende Beschreibungen', () => {
		expect(alleBilderBeschrieben(`<img src="/dateien/${A}" alt="Chor">`)).toBe(true);
		expect(alleBilderBeschrieben(`<img src="/dateien/${A}" alt="  ">`)).toBe(false);
		expect(alleBilderBeschrieben(`<img src="/dateien/${A}">`)).toBe(false);
	});
});

describe('Tabellen und Infokästen', () => {
	const html =
		'<table style="min-width:50px"><colgroup><col></colgroup><tbody><tr><th colspan="2" onclick="x()"><p>Kopf</p></th></tr><tr><td><p>A</p></td></tr></tbody></table>' +
		'<div class="kasten kasten-warnung boese" style="color:red"><p>Achtung</p></div><div class="kasten kasten-xyz"><p>B</p></div>';

	it('nur im erweiterten Editor', () => {
		expect(cleanHtml(html)).toBe('<p>Kopf</p><p>A</p><p>Achtung</p><p>B</p>');
	});

	it('Tabellen ohne Attribute, Kästen nur mit bekannten Klassen', () => {
		expect(cleanHtml(html, { erweitert: true })).toBe(
			'<table><tbody><tr><th><p>Kopf</p></th></tr><tr><td><p>A</p></td></tr></tbody></table>' +
				'<div class="kasten kasten-warnung"><p>Achtung</p></div><div class="kasten"><p>B</p></div>'
		);
	});

	it('Text für Suche trennt Zellen', () => {
		expect(htmlToText('<table><tr><td>A</td><td>B</td></tr></table>')).toBe('A B');
	});
});
