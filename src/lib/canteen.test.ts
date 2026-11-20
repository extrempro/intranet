import { describe, expect, it } from 'vitest';
import {
	addDays,
	berlinNow,
	checkClosure,
	checkHours,
	checkMenuDates,
	closureNotices,
	closureTitle,
	defaultHours,
	hoursSummary,
	isoWeek,
	menuTitle,
	openState
} from './canteen.ts';

describe('Öffnungszeiten', () => {
	it('prüft Uhrzeiten nur an offenen Tagen', () => {
		const h = defaultHours();
		expect(checkHours(h)).toBeNull();
		h[0] = { open: true, from: '14:00', to: '11:00' };
		expect(checkHours(h)).toMatch(/Montag/);
		h[0] = { open: false, from: '', to: '' };
		expect(checkHours(h)).toBeNull();
	});

	it('berechnet „Jetzt geöffnet“', () => {
		const h = defaultHours();
		const mo = (time: string) => ({ date: '2026-11-23', weekday: 0, time });
		expect(openState(h, mo('12:00'), false)).toEqual({
			open: true,
			text: 'Jetzt geöffnet bis 14:00'
		});
		expect(openState(h, mo('10:00'), false).text).toBe('Jetzt geschlossen · öffnet um 11:30');
		expect(openState(h, mo('14:00'), false).open).toBe(false);
		expect(openState(h, { date: '2026-11-28', weekday: 5, time: '12:00' }, false).text).toBe(
			'Heute Ruhetag'
		);
		expect(openState(h, mo('12:00'), true).text).toBe('Heute geschlossen');
	});

	it('fasst gleiche Tage zusammen', () => {
		expect(hoursSummary(defaultHours())).toEqual([
			{ days: 'Mo–Fr', time: '11:30–14:00' },
			{ days: 'Sa–So', time: 'Ruhetag' }
		]);
	});
});

describe('Schließzeiten', () => {
	const c = (fromDate: string, untilDate: string, announceDays = 0) => ({
		fromDate,
		untilDate,
		reason: null,
		announceDays
	});

	it('zeigt aktive und angekündigte Schließungen', () => {
		const list = [c('2026-11-20', '2026-11-20'), c('2026-12-22', '2027-01-06', 7)];
		expect(closureNotices(list, '2026-11-20').active?.fromDate).toBe('2026-11-20');
		expect(closureNotices(list, '2026-12-14').announced).toHaveLength(0);
		expect(closureNotices(list, '2026-12-15').announced).toHaveLength(1);
		expect(closureNotices(list, '2026-12-22').active?.untilDate).toBe('2027-01-06');
	});

	it('formuliert den Titel wie im Entwurf', () => {
		expect(closureTitle(c('2026-11-20', '2026-11-20'))).toBe('Geschlossen am Freitag, 20.11.');
		expect(closureTitle(c('2026-12-22', '2027-01-06'))).toBe('Geschlossen bis Mittwoch, 06.01.');
	});

	it('prüft Eingaben', () => {
		expect(checkClosure(c('2026-11-24', '2026-11-23'), '2026-11-20').untilDate).toBeTruthy();
		expect(checkClosure(c('2026-11-01', '2026-11-02'), '2026-11-20').untilDate).toBeTruthy();
		expect(
			checkClosure({ ...c('2026-11-24', '2026-11-25'), announceDays: 5 }, '2026-11-20')
		).toHaveProperty('announceDays');
		expect(checkClosure(c('2026-11-24', '2026-11-25', 7), '2026-11-20')).toEqual({});
	});
});

describe('Speisepläne', () => {
	it('benennt Wochenpläne nach Kalenderwoche', () => {
		expect(isoWeek('2026-11-23')).toBe(48);
		expect(isoWeek('2027-01-01')).toBe(53);
		expect(menuTitle('2026-11-23', '2026-11-27')).toBe('Speiseplan KW 48');
		expect(menuTitle('2026-11-23', '2026-12-04')).toBe('Speiseplan 23.11.–04.12.2026');
	});

	it('prüft Zeiträume', () => {
		expect(checkMenuDates('2026-11-23', '2026-11-27', '2026-11-20')).toEqual({});
		expect(checkMenuDates('2026-11-23', '2026-11-20', '2026-11-20').validUntil).toBeTruthy();
		expect(checkMenuDates('2026-11-01', '2026-11-19', '2026-11-20').validUntil).toBeTruthy();
		expect(checkMenuDates('2026-11-23', '2027-03-01', '2026-11-20').validUntil).toBeTruthy();
	});

	it('rechnet in Berliner Zeit', () => {
		// 23:30 UTC am 22.11. ist in Berlin schon Montag, 23.11.
		expect(berlinNow(new Date('2026-11-22T23:30:00Z'))).toEqual({
			date: '2026-11-23',
			weekday: 0,
			time: '00:30'
		});
		expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
	});
});
