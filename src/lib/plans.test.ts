import { describe, expect, it } from 'vitest';
import { formatMonth, formatRange, planState, validatePlan } from './plans';

describe('validatePlan', () => {
	it('nimmt gültige Angaben an', () => {
		expect(
			validatePlan({ title: 'Wochenplan KW 48', validFrom: '2026-11-23', validUntil: '2026-11-29' })
		).toEqual({});
	});
	it('meldet fehlende oder verdrehte Angaben', () => {
		const e = validatePlan({ title: 'x', validFrom: '', validUntil: '2026-11-01' });
		expect(e.title).toBeDefined();
		expect(e.validFrom).toBeDefined();
		expect(
			validatePlan({ title: 'Plan', validFrom: '2026-11-10', validUntil: '2026-11-01' }).validUntil
		).toMatch(/nicht vor/);
	});
});

describe('planState', () => {
	const p = { validFrom: '2026-11-23', validUntil: '2026-11-29' };
	it('unterscheidet künftig, aktuell, abgelaufen', () => {
		expect(planState(p, '2026-11-20')).toBe('kuenftig');
		expect(planState(p, '2026-11-23')).toBe('aktuell');
		expect(planState(p, '2026-11-29')).toBe('aktuell');
		expect(planState(p, '2026-11-30')).toBe('abgelaufen');
	});
});

describe('Anzeige', () => {
	it('kürzt Zeiträume sinnvoll', () => {
		expect(formatRange('2026-11-23', '2026-11-29')).toBe('23.11.–29.11.2026');
		expect(formatRange('2026-12-28', '2027-01-03')).toBe('28.12.2026–03.01.2027');
		expect(formatRange('2026-11-23', '2026-11-23')).toBe('23.11.2026');
	});
	it('zeigt den Monat', () => {
		expect(formatMonth('2026-11')).toBe('November 2026');
	});
});
