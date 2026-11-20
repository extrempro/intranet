import { describe, expect, it } from 'vitest';
import { fitsRoles, parseArticle } from './handbook.ts';

describe('Handbuch', () => {
	it('liest Kopfzeilen', () => {
		const { meta, body } = parseArticle(
			'x',
			'---\ntitel: Test: Doppelpunkt\nkapitel: pflegen\nrollen: redaktion, verwaltung\nreihenfolge: 3\nkurz: Kurz\n---\n\n## Text'
		);
		expect(meta).toEqual({
			slug: 'x',
			title: 'Test: Doppelpunkt',
			chapter: 'pflegen',
			roles: ['redaktion', 'verwaltung'],
			order: 3,
			summary: 'Kurz'
		});
		expect(body).toBe('## Text');
		expect(fitsRoles(meta, new Set(['alle']))).toBe(false);
		expect(fitsRoles(meta, new Set(['alle', 'redaktion']))).toBe(true);
	});

	it('meldet Fehler in Artikeln', () => {
		expect(() => parseArticle('a', 'ohne Kopf')).toThrow();
		expect(() => parseArticle('a', '---\ntitel: T\nkapitel: quatsch\n---\n')).toThrow();
		expect(() =>
			parseArticle('a', '---\ntitel: T\nkapitel: pflegen\nrollen: chef\n---\n')
		).toThrow();
	});
});
