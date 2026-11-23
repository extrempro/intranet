import { describe, expect, it } from 'vitest';
import { berlinHour, greeting, moveItem, resolveLayout } from './home';

const cards = [
	{ id: 'neuigkeiten', label: 'Neuigkeiten' },
	{ id: 'termine', label: 'Heute und morgen' },
	{ id: 'speiseplan', label: 'Speiseplan' }
];

describe('resolveLayout', () => {
	it('nimmt ohne Einstellungen die Standardreihenfolge', () => {
		expect(resolveLayout(cards, null, null).map((c) => c.id)).toEqual([
			'neuigkeiten',
			'termine',
			'speiseplan'
		]);
	});

	it('nimmt die persönliche Einstellung vor dem Mandanten-Standard', () => {
		const r = resolveLayout(
			cards,
			{ order: ['speiseplan', 'neuigkeiten'], hidden: ['neuigkeiten'] },
			{ order: ['termine'], hidden: [] }
		);
		expect(r).toEqual([
			{ id: 'speiseplan', label: 'Speiseplan', visible: true },
			{ id: 'neuigkeiten', label: 'Neuigkeiten', visible: false },
			{ id: 'termine', label: 'Heute und morgen', visible: true }
		]);
	});

	it('lässt unbekannte und doppelte Karten weg', () => {
		const r = resolveLayout(cards, { order: ['alt', 'termine', 'termine'], hidden: [] }, null);
		expect(r.map((c) => c.id)).toEqual(['termine', 'neuigkeiten', 'speiseplan']);
	});
});

describe('moveItem', () => {
	it('verschiebt innerhalb der Liste', () => {
		expect(moveItem(['a', 'b', 'c'], 1, -1)).toEqual(['b', 'a', 'c']);
		expect(moveItem(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'c', 'b']);
	});

	it('ändert am Rand nichts', () => {
		expect(moveItem(['a', 'b'], 0, -1)).toEqual(['a', 'b']);
		expect(moveItem(['a', 'b'], 1, 1)).toEqual(['a', 'b']);
	});
});

describe('berlinHour', () => {
	it('Stunde in Berlin als Zahl, auch im Winter und Sommer', () => {
		expect(berlinHour(new Date('2026-11-23T07:00:00Z'))).toBe(8);
		expect(berlinHour(new Date('2026-07-01T05:30:00Z'))).toBe(7);
		expect(berlinHour(new Date('2026-11-23T23:10:00Z'))).toBe(0);
		expect(greeting(berlinHour(new Date('2026-11-23T07:00:00Z')))).toBe('Guten Morgen');
	});
});

describe('greeting', () => {
	it('passt zur Tageszeit', () => {
		expect(greeting(8)).toBe('Guten Morgen');
		expect(greeting(14)).toBe('Hallo');
		expect(greeting(20)).toBe('Guten Abend');
	});
});
