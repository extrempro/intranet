import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ohneKommentare, parseChangelog } from './changelog.ts';

describe('Neu im Intranet (CHANGELOG.md)', () => {
	const raw = readFileSync('CHANGELOG.md', 'utf8');
	const entries = parseChangelog(raw);

	it('liest Version, Datum, Titel und Text', () => {
		const e = parseChangelog(
			'## 1.2.3 · 01.02.2026 · Titel\n\n- Punkt\n<!-- nicht -->\n## 1.2.2 · 01.01.2026 · Alt\nText'
		);
		expect(e).toEqual([
			{ version: '1.2.3', date: '01.02.2026', title: 'Titel', body: '- Punkt' },
			{ version: '1.2.2', date: '01.01.2026', title: 'Alt', body: 'Text' }
		]);
	});

	it('neuester Eintrag hat die Version aus package.json', () => {
		const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };
		expect(entries[0]?.version).toBe(pkg.version);
	});

	it('Versionen sind absteigend und eindeutig, jeder Eintrag hat Text', () => {
		const zahl = (v: string) => v.split('.').map(Number);
		for (let i = 1; i < entries.length; i++) {
			const [a, b] = [zahl(entries[i - 1].version), zahl(entries[i].version)];
			const groesser = a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
			expect(groesser, `${entries[i - 1].version} vor ${entries[i].version}`).toBeGreaterThan(0);
		}
		for (const e of entries) expect(e.body.length, e.version).toBeGreaterThan(0);
	});

	it('jede Überschrift „## …“ hat das richtige Format', () => {
		const ohneKommentar = ohneKommentare(raw);
		const koepfe = ohneKommentar.split('\n').filter((l) => l.startsWith('## '));
		expect(koepfe.length).toBe(entries.length);
	});
});

describe('ohneKommentare', () => {
	it('entfernt Kommentarblöcke zeilenweise, auch verschachtelte Reste', () => {
		expect(ohneKommentare('a\n<!-- x -->\nb')).toBe('a\nb');
		expect(ohneKommentare('a\n<!--\nText\n-->\nb')).toBe('a\nb');
		expect(ohneKommentare('a\n<!<!-- x\n-- y -->\nb')).toBe('a\nb');
		expect(ohneKommentare('a\n<!-- offen\nb')).toBe('a');
	});
});
