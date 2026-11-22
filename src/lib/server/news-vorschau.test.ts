import { describe, expect, it } from 'vitest';
import { lesezeit, tabellenVorschau } from './news-vorschau.ts';

describe('Vorschau für Beiträge', () => {
	it('liest die ersten Zeilen der ersten Tabelle als Text', () => {
		const html =
			'<p>Zeiten:</p><table><thead><tr><th>Tag</th><th>Mittag</th><th>Café</th><th>Extra</th></tr></thead>' +
			'<tbody><tr><td><strong>Mo&nbsp;–&nbsp;Do</strong></td><td>11:30–14:00</td><td>bis 16:00</td></tr>' +
			'<tr><td>Fr</td><td>11:30–13:30</td><td></td></tr>' +
			'<tr><td>Sa</td><td>zu</td><td>zu</td></tr><tr><td>So</td><td>zu</td><td>zu</td></tr></tbody></table>';
		expect(tabellenVorschau(html)).toEqual([
			['Tag', 'Mittag', 'Café'],
			['Mo – Do', '11:30–14:00', 'bis 16:00'],
			['Fr', '11:30–13:30', ''],
			['Sa', 'zu', 'zu']
		]);
	});

	it('kürzt lange Zellen und gibt kein HTML weiter', () => {
		const t = tabellenVorschau(
			'<table><tr><td>&lt;script&gt;Ein sehr langer Text, der nicht in die Zelle passt</td></tr></table>'
		);
		expect(t?.[0][0].length).toBeLessThanOrEqual(28);
		expect(t?.[0][0]).toMatch(/^<script>Ein/);
	});

	it('ohne Tabelle oder leere Tabelle: keine Vorschau', () => {
		expect(tabellenVorschau('<p>Nur Text</p>')).toBeNull();
		expect(tabellenVorschau('<table><tr><td></td></tr></table>')).toBeNull();
		expect(tabellenVorschau(null)).toBeNull();
	});

	it('Lesezeit mindestens eine Minute', () => {
		expect(lesezeit('')).toBe(1);
		expect(lesezeit(Array(600).fill('Wort').join(' '))).toBe(3);
	});
});
