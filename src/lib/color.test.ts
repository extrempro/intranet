import { describe, expect, it } from 'vitest';
import { BG_DEFAULT, BG_DEFAULT_DARK, checkBackground } from './color.ts';

describe('Seitenhintergrund', () => {
	it('Standardfarben haben genug Kontrast', () => {
		expect(checkBackground(BG_DEFAULT, BG_DEFAULT_DARK, '#0F6E56', '#5DCAA5').ok).toBe(true);
	});

	it('zu dunkler heller Hintergrund fällt durch', () => {
		const k = checkBackground('#9AA39F', BG_DEFAULT_DARK, '#0F6E56', '#5DCAA5');
		expect(k.ok).toBe(false);
		expect(k.hell.gedaempft).toBeLessThan(4.5);
	});

	it('zu heller dunkler Hintergrund fällt durch', () => {
		expect(checkBackground(BG_DEFAULT, '#5A6460', '#0F6E56', '#5DCAA5').ok).toBe(false);
	});
});
