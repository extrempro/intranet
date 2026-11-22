import { describe, expect, it } from 'vitest';
import {
	berlinMitternacht,
	DEFAULT_QUIET,
	deliverAfter,
	digestModesDue,
	isAbsent,
	isQuiet,
	quietUntil,
	resolveAbsence,
	resolveNotify,
	resolveQuiet,
	ruheText
} from './notify.ts';

describe('Benachrichtigungen', () => {
	it('füllt Voreinstellungen nach Tabelle 11.2 auf', () => {
		const r = resolveNotify(null);
		expect(r.emailMode).toBe('taeglich');
		expect(r.topics.dringend).toEqual({ bell: true, push: true, email: true, teams: true });
		// Teams wie Push voreingestellt
		expect(r.topics.angeheftet).toEqual({ bell: true, push: true, email: false, teams: true });
		expect(r.topics.nachrichten.teams).toBe(true);
		expect(r.topics.hubs.teams).toBe(false);
		expect(r.topics.speiseplan).toEqual({ bell: false, push: false, email: false, teams: false });
	});

	it('übernimmt eigene Einstellungen, aber nie „Glocke aus“ bei dringenden Meldungen', () => {
		const r = resolveNotify({
			topics: { dringend: { bell: false, email: false }, neuigkeiten: { email: false } },
			emailMode: 'sofort'
		});
		expect(r.topics.dringend).toEqual({ bell: true, push: true, email: false, teams: true });
		expect(r.topics.neuigkeiten).toEqual({ bell: true, push: false, email: false, teams: false });
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
	// Ältere Form wird übernommen: Mo–Fr 20–7 Uhr, Wochenende ganztägig
	const alt = { on: true, start: '20:00', end: '07:00', weekend: true, urgent: true };
	const q = resolveQuiet(alt);

	it('übernimmt die ältere Form in sieben Tage', () => {
		expect(q.days.slice(0, 5).every((d) => d.art === 'zeit' && d.start === '20:00')).toBe(true);
		expect(q.days.slice(5).every((d) => d.art === 'ganztags')).toBe(true);
		expect(resolveQuiet({ ...alt, weekend: false }).days.every((d) => d.art === 'zeit')).toBe(true);
		expect(resolveQuiet(null)).toEqual(DEFAULT_QUIET);
	});

	it('werktags nachts und am Wochenende ruhig', () => {
		expect(isQuiet({ weekday: 0, time: '21:00' }, q)).toBe(true);
		expect(isQuiet({ weekday: 0, time: '06:59' }, q)).toBe(true);
		expect(isQuiet({ weekday: 0, time: '07:00' }, q)).toBe(false);
		expect(isQuiet({ weekday: 5, time: '12:00' }, q)).toBe(true);
		expect(isQuiet({ weekday: 5, time: '12:00' }, resolveQuiet({ ...alt, weekend: false }))).toBe(
			false
		);
		expect(isQuiet({ weekday: 2, time: '23:00' }, { ...q, on: false })).toBe(false);
	});

	it('jeder Tag eigen: Zeitraum, ganztägig, keine Ruhe', () => {
		const tage = resolveQuiet({
			on: true,
			urgent: false,
			days: [
				{ art: 'zeit', start: '12:00', end: '13:00' },
				{ art: 'keine', start: '20:00', end: '07:00' },
				{ art: 'ganztags', start: '20:00', end: '07:00' },
				{ art: 'zeit', start: '22:00', end: '06:00' },
				{ art: 'quatsch' as never, start: '99:00', end: '07:00' },
				{ art: 'keine', start: '20:00', end: '07:00' },
				{ art: 'keine', start: '20:00', end: '07:00' }
			]
		});
		expect(isQuiet({ weekday: 0, time: '12:30' }, tage)).toBe(true);
		expect(isQuiet({ weekday: 0, time: '13:00' }, tage)).toBe(false);
		expect(isQuiet({ weekday: 1, time: '23:00' }, tage)).toBe(false);
		expect(isQuiet({ weekday: 2, time: '12:00' }, tage)).toBe(true);
		expect(isQuiet({ weekday: 3, time: '05:00' }, tage)).toBe(true);
		// Ungültiges wird zur Voreinstellung des Tages (Freitag 20–7 Uhr)
		expect(tage.days[4]).toEqual({ art: 'zeit', start: '20:00', end: '07:00' });
		expect(ruheText(tage)).toBe(
			'Zurzeit: Mo 12:00 bis 13:00 Uhr, Di keine Ruhe, Mi ganztägig, Do bis 06:00 und ab 22:00 Uhr, Fr bis 07:00 und ab 20:00 Uhr, Sa–So keine Ruhe. Auch dringende Meldungen warten bis zum Ende der Ruhezeit.'
		);
		expect(ruheText(q)).toBe(
			'Zurzeit: Mo–Fr bis 07:00 und ab 20:00 Uhr, Sa–So ganztägig. Dringende Meldungen kommen trotzdem sofort.'
		);
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
		expect(r.quiet.on).toBe(false);
		expect(r.quiet.urgent).toBe(false);
		expect(r.quiet.days[0]).toEqual({ art: 'zeit', start: '20:00', end: '06:00' });
		expect(r.absence).toBeNull();
	});
});

describe('Abwesenheit', () => {
	const q = resolveQuiet(null);

	it('prüft Tage und Länge', () => {
		expect(resolveAbsence({ from: '2026-12-21', to: '2026-12-20' })).toBeNull();
		expect(resolveAbsence({ from: '2026-12-21', to: '2028-01-01' })).toBeNull();
		expect(resolveAbsence({ from: 'gestern', to: '2026-12-20' })).toBeNull();
		expect(resolveAbsence({ from: '2026-12-21', to: '2027-01-04', urgent: true })).toEqual({
			from: '2026-12-21',
			to: '2027-01-04',
			urgent: true
		});
		expect(isAbsent('2026-12-21', { from: '2026-12-21', to: '2026-12-21', urgent: false })).toBe(
			true
		);
		expect(isAbsent('2026-12-22', { from: '2026-12-21', to: '2026-12-21', urgent: false })).toBe(
			false
		);
	});

	it('stellt nach der Abwesenheit zu, danach gelten die Ruhezeiten', () => {
		const absence = { from: '2026-12-21', to: '2027-01-03', urgent: false };
		// Mittwoch, 23.12., 10:00 Berlin: zurück Montag 04.01., Ruhe bis 07:00
		expect(
			deliverAfter('neuigkeiten', new Date('2026-12-23T09:00:00Z'), {
				quiet: q,
				absence
			})?.toISOString()
		).toBe('2027-01-04T06:00:00.000Z');
		// Dringend ohne Ausnahme: ab Mitternacht nach der Abwesenheit (Ruhe-Ausnahme gilt)
		expect(
			deliverAfter('dringend', new Date('2026-12-23T09:00:00Z'), {
				quiet: q,
				absence
			})?.toISOString()
		).toBe('2027-01-03T23:00:00.000Z');
		// Dringend mit Ausnahme: sofort
		expect(
			deliverAfter('dringend', new Date('2026-12-23T09:00:00Z'), {
				quiet: q,
				absence: { ...absence, urgent: true }
			})
		).toBeNull();
		// Vor der Abwesenheit: wie sonst
		expect(
			deliverAfter('neuigkeiten', new Date('2026-12-16T09:00:00Z'), { quiet: q, absence })
		).toBeNull();
		expect(berlinMitternacht('2026-07-08').toISOString()).toBe('2026-07-07T22:00:00.000Z');
	});
});
