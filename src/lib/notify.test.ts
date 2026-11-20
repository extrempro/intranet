import { describe, expect, it } from 'vitest';
import { digestModesDue, isQuiet, quietUntil, resolveNotify } from './notify.ts';

describe('Benachrichtigungen', () => {
	it('füllt Voreinstellungen nach Tabelle 11.2 auf', () => {
		const r = resolveNotify(null);
		expect(r.emailMode).toBe('taeglich');
		expect(r.topics.dringend).toEqual({ bell: true, push: true, email: true });
		expect(r.topics.angeheftet).toEqual({ bell: true, push: true, email: false });
		expect(r.topics.speiseplan).toEqual({ bell: false, push: false, email: false });
	});

	it('übernimmt eigene Einstellungen, aber nie „Glocke aus“ bei dringenden Meldungen', () => {
		const r = resolveNotify({
			topics: { dringend: { bell: false, email: false }, neuigkeiten: { email: false } },
			emailMode: 'sofort'
		});
		expect(r.topics.dringend).toEqual({ bell: true, push: true, email: false });
		expect(r.topics.neuigkeiten).toEqual({ bell: true, push: false, email: false });
		expect(r.emailMode).toBe('sofort');
		expect(resolveNotify({ topics: {}, emailMode: 'quatsch' as never }).emailMode).toBe('taeglich');
	});

	it('verschickt Zusammenfassungen einmal am Tag ab 7 Uhr', () => {
		const fr = { date: '2026-11-20', weekday: 4, time: '07:00' };
		expect(digestModesDue({ ...fr, time: '06:59' }, null)).toEqual([]);
		expect(digestModesDue(fr, null)).toEqual(['taeglich']);
		expect(digestModesDue(fr, '2026-11-20')).toEqual([]);
		expect(digestModesDue({ date: '2026-11-23', weekday: 0, time: '09:15' }, '2026-11-20')).toEqual(
			['taeglich', 'woechentlich']
		);
	});
});

describe('Ruhezeiten', () => {
	const q = { on: true, start: '20:00', end: '07:00', weekend: true, urgent: true };

	it('werktags nachts und am Wochenende ruhig', () => {
		expect(isQuiet({ weekday: 0, time: '21:00' }, q)).toBe(true);
		expect(isQuiet({ weekday: 0, time: '06:59' }, q)).toBe(true);
		expect(isQuiet({ weekday: 0, time: '07:00' }, q)).toBe(false);
		expect(isQuiet({ weekday: 5, time: '12:00' }, q)).toBe(true);
		expect(isQuiet({ weekday: 5, time: '12:00' }, { ...q, weekend: false })).toBe(false);
		expect(isQuiet({ weekday: 2, time: '23:00' }, { ...q, on: false })).toBe(false);
	});

	it('findet das Ende der Ruhezeit in Berliner Zeit', () => {
		// Freitag, 20.11.2026, 21:00 Berlin (UTC+1) → Montag 07:00 Berlin
		expect(quietUntil(new Date('2026-11-20T20:00:00Z'), q)?.toISOString()).toBe(
			'2026-11-23T06:00:00.000Z'
		);
		// Mittwoch 22:30 Berlin → Donnerstag 07:00
		expect(quietUntil(new Date('2026-11-18T21:30:00Z'), q)?.toISOString()).toBe(
			'2026-11-19T06:00:00.000Z'
		);
		// Ruhezeit fast den ganzen Tag: Ende um 23:59
		expect(
			quietUntil(new Date('2026-11-18T11:00:00Z'), {
				...q,
				start: '00:00',
				end: '23:59'
			})?.toISOString()
		).toBe('2026-11-18T22:59:00.000Z');
		// Mittwoch 12:00 → keine Ruhezeit
		expect(quietUntil(new Date('2026-11-18T11:00:00Z'), q)).toBeNull();
		// Sommerzeit: Dienstag 23:00 Berlin (UTC+2) → Mittwoch 07:00 = 05:00 UTC
		expect(quietUntil(new Date('2026-07-07T21:00:00Z'), q)?.toISOString()).toBe(
			'2026-07-08T05:00:00.000Z'
		);
	});

	it('füllt fehlende oder ungültige Werte auf und hält Push bei Dringend fest', () => {
		const r = resolveNotify({
			topics: { dringend: { push: false } },
			emailMode: 'sofort',
			quiet: { on: false, start: '25:00', end: '06:00', weekend: false, urgent: false }
		});
		expect(r.topics.dringend.push).toBe(true);
		expect(r.quiet).toEqual({
			on: false,
			start: '20:00',
			end: '06:00',
			weekend: false,
			urgent: false
		});
	});
});
