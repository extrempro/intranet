import { describe, expect, it } from 'vitest';
import { cleanHtml, excerpt, htmlToText } from './html';

describe('cleanHtml', () => {
	it('behält erlaubte Formatierung', () => {
		expect(
			cleanHtml('<h2>Titel</h2><p><strong>fett</strong> und <em>kursiv</em></p><ul><li>a</li></ul>')
		).toBe('<h2>Titel</h2><p><strong>fett</strong> und <em>kursiv</em></p><ul><li>a</li></ul>');
	});

	it('entfernt Skripte, Ereignisse und Stile', () => {
		const out = cleanHtml(
			'<p onclick="x()" style="color:red">a<script>alert(1)</script><img src=x onerror=alert(1)><iframe src="//evil"></iframe></p>'
		);
		expect(out).toBe('<p>a</p>');
	});

	it('lässt nur sichere Links zu und setzt rel', () => {
		expect(cleanHtml('<a href="javascript:alert(1)">x</a>')).toBe('x');
		expect(cleanHtml('<a href="//evil.de">x</a>')).toBe('x');
		expect(cleanHtml('<a href="https://example.de" target="_blank">x</a>')).toBe(
			'<a rel="noopener noreferrer nofollow" href="https://example.de">x</a>'
		);
	});

	it('macht aus h1 ein h2 (eine Hauptüberschrift je Seite)', () => {
		expect(cleanHtml('<h1>A</h1>')).toBe('<h2>A</h2>');
	});
});

describe('htmlToText und excerpt', () => {
	it('liefert lesbaren Text', () => {
		expect(htmlToText('<h2>A</h2><p>B &amp; C</p><ul><li>D</li></ul>')).toBe('A B & C D');
	});
	it('kürzt an Wortgrenzen', () => {
		expect(excerpt('eins zwei drei vier', 12)).toBe('eins zwei …');
	});
});
