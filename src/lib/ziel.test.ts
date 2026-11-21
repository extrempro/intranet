import { describe, expect, it } from 'vitest';
import einstieg from './teams-app/einstieg.js?raw';
import { safeTarget } from './ziel.ts';

const GUT: [string, string][] = [
	['/', '/'],
	['/neuigkeiten/1', '/neuigkeiten/1'],
	['/suche?q=a%20b#x', '/suche?q=a%20b#x'],
	['/a/../plaene', '/plaene']
];

// Alles, was ein Browser als fremde Adresse lesen würde
const BOESE = [
	'',
	'neuigkeiten',
	'https://fremd.example',
	'//fremd.example',
	'/\\fremd.example',
	'\\\\fremd.example',
	'/\t/fremd.example',
	'/\n/fremd.example',
	'/\r/fremd.example',
	'\t//fremd.example',
	'/x\u0000',
	'javascript:alert(1)'
];

/** Die gleiche Prüfung im Skript der Teams-App (läuft ohne Build im Browser) */
function sicherAusEinstieg(): (z: string) => string {
	const m = /function sicher\(ziel\) \{[\s\S]*?\n\t\}\n/.exec(einstieg);
	if (!m) throw new Error('sicher() in einstieg.js nicht gefunden');
	return new Function('location', `${m[0]}; return sicher;`)({
		origin: 'https://intranet.example'
	});
}

describe('Rücksprungziele', () => {
	it('lässt eigene Pfade durch', () => {
		for (const [ein, aus] of GUT) expect(safeTarget(ein, 300)).toBe(aus);
	});

	it('lehnt fremde Adressen ab, auch mit Tabulator, Zeilenumbruch und Backslash', () => {
		for (const b of BOESE) expect(safeTarget(b, 300), JSON.stringify(b)).toBe('/');
	});

	it('lehnt zu lange Ziele ab', () => {
		expect(safeTarget(`/${'a'.repeat(400)}`, 300)).toBe('/');
	});

	it('prüft im Skript der Teams-App genauso', () => {
		const sicher = sicherAusEinstieg();
		for (const [ein, aus] of GUT) expect(sicher(ein)).toBe(aus);
		for (const b of BOESE) expect(sicher(b), JSON.stringify(b)).toBe('/');
	});
});
