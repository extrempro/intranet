import { describe, expect, it } from 'vitest';
import { normalizeUiFarben, palette, pruefePalette } from './color.ts';

describe('Oberflächenfarben', () => {
	it('Standard hell und dunkel haben genug Kontrast', () => {
		expect(pruefePalette(palette('hell', '#0F6E56', '#0F6E56')).ok).toBe(true);
		expect(pruefePalette(palette('dunkel', '#5DCAA5', '#0F6E56')).ok).toBe(true);
	});

	it('leitet im Dunkeln Fläche und Rahmen aus eigenem Hintergrund ab', () => {
		const p = palette('dunkel', '#F2A36B', '#0F6E56', { hintergrund: '#000000' });
		expect(p.flaeche).toBe('#141414');
		expect(p.rahmen).toBe('#2E2E2E');
		expect(pruefePalette(p).ok).toBe(true);
	});

	it('eigene Werte haben Vorrang, zu wenig Kontrast fällt durch', () => {
		const p = palette('hell', '#0F6E56', '#0F6E56', { grau: '#9AA39F' });
		expect(p.grau).toBe('#9AA39F');
		expect(pruefePalette(p).ok).toBe(false);
		expect(
			pruefePalette(palette('hell', '#0F6E56', '#0F6E56', { knopf: '#7FD8BE' })).knopf
		).toBeLessThan(4.5);
	});

	it('übernimmt nur gültige Hex-Werte', () => {
		expect(
			normalizeUiFarben({ hell: { knopf: '#abcdef', text: 'rot' }, dunkel: 'x', fremd: {} })
		).toEqual({ hell: { knopf: '#ABCDEF' } });
	});
});
