/**
 * Führungen und Einführungen (Kap. 13): Jedes Ziel muss es als data-tour im
 * Code geben, sonst erscheint der Schritt nur mittig ohne Hervorhebung.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FUEHRUNG, ROLLEN, SEITEN } from './tours.ts';

function dateien(dir: string): string[] {
	return readdirSync(dir).flatMap((n) => {
		const p = join(dir, n);
		return statSync(p).isDirectory() ? dateien(p) : p.endsWith('.svelte') ? [p] : [];
	});
}

const code = dateien('src')
	.map((p) => readFileSync(p, 'utf8'))
	.join('\n');
const vorhanden = new Set([...code.matchAll(/data-tour="([^"{$]+)"/g)].map((m) => m[1]));
// Ziele, die per Eigenschaft gesetzt werden (z. B. tour={'beitraege'})
for (const m of code.matchAll(/'([a-z-]+)'\s*:\s*undefined\}/g)) vorhanden.add(m[1]);

const alle = [FUEHRUNG, ...Object.values(SEITEN), ...Object.values(ROLLEN)];

describe('Führungen', () => {
	for (const tour of alle) {
		it(`${tour.title}: alle Ziele gibt es im Code`, () => {
			for (const s of tour.steps) {
				if (!s.target) continue;
				const namen = s.target.split(',').map((n) => n.trim());
				expect(
					namen.some((n) => vorhanden.has(n)),
					`${tour.title} · ${s.title}: ${s.target}`
				).toBe(true);
			}
		});
	}

	it('Schlüssel sind eindeutig', () => {
		const keys = alle.map((t) => t.key);
		expect(new Set(keys).size).toBe(keys.length);
	});
});
