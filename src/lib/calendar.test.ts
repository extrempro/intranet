import { describe, expect, it } from 'vitest';
import {
	buildIcs,
	dayHeading,
	foldLine,
	icsEscape,
	monthCells,
	shiftMonth,
	timeLabel,
	validateEvent
} from './calendar.ts';

const base = {
	title: 'Erste-Hilfe-Kurs',
	date: '2026-11-25',
	allDay: false,
	startTime: '10:00',
	endTime: '11:00',
	place: '',
	description: ''
};

describe('Termine prüfen', () => {
	it('akzeptiert gültige Termine', () => {
		expect(validateEvent(base)).toEqual({});
		expect(validateEvent({ ...base, allDay: true, startTime: '', endTime: '' })).toEqual({});
		expect(validateEvent({ ...base, endTime: '' })).toEqual({});
	});
	it('meldet Fehler', () => {
		expect(validateEvent({ ...base, title: 'x' }).title).toBeTruthy();
		expect(validateEvent({ ...base, startTime: '' }).startTime).toBeTruthy();
		expect(validateEvent({ ...base, endTime: '09:00' }).endTime).toBeTruthy();
		expect(validateEvent({ ...base, date: '25.11.2026' }).date).toBeTruthy();
		expect(validateEvent({ ...base, title: 'x'.repeat(91) }).title).toBeTruthy();
	});
});

describe('Anzeige', () => {
	it('beschriftet Zeiten und Tage', () => {
		expect(timeLabel({ allDay: true, startTime: null, endTime: null })).toBe('ganztägig');
		expect(timeLabel({ allDay: false, startTime: '10:00', endTime: '11:30' })).toBe('10:00–11:30');
		expect(dayHeading('2026-11-20', '2026-11-20')).toBe('Heute · Freitag, 20.11.');
		expect(dayHeading('2026-11-21', '2026-11-20')).toBe('Morgen · Samstag, 21.11.');
		expect(dayHeading('2027-01-04', '2026-11-20')).toBe('Montag, 04.01.2027');
	});
	it('baut das Monatsraster ab Montag', () => {
		const cells = monthCells('2026-11');
		expect(cells.slice(0, 7)).toEqual([null, null, null, null, null, null, '2026-11-01']);
		expect(cells.length % 7).toBe(0);
		expect(cells.filter(Boolean)).toHaveLength(30);
		expect(shiftMonth('2026-12', 1)).toBe('2027-01');
		expect(shiftMonth('2026-01', -1)).toBe('2025-12');
	});
});

describe('iCalendar', () => {
	it('maskiert und faltet', () => {
		expect(icsEscape('a,b;c\\d\ne')).toBe('a\\,b\\;c\\\\d\\ne');
		const folded = foldLine(`SUMMARY:${'ä'.repeat(60)}`);
		for (const l of folded.split('\r\n'))
			expect(new TextEncoder().encode(l).length).toBeLessThanOrEqual(75);
	});
	it('schreibt Zeiten in UTC und ganztägige als Datum', () => {
		const ics = buildIcs(
			[
				{
					id: 'a',
					...base,
					place: 'Probebühne 1',
					sender: 'IT',
					description: 'geheim',
					updatedAt: new Date('2026-11-20T10:00:00Z')
				},
				{
					id: 'b',
					...base,
					date: '2026-07-01',
					allDay: true,
					startTime: null,
					endTime: null,
					place: null,
					sender: 'Personal',
					updatedAt: new Date('2026-11-20T10:00:00Z')
				}
			],
			{ name: 'Intranet', host: 'intranet.test' }
		);
		expect(ics).toContain('DTSTART:20261125T090000Z');
		expect(ics).toContain('DTEND:20261125T100000Z');
		expect(ics).toContain('DTSTART;VALUE=DATE:20260701');
		expect(ics).toContain('DTEND;VALUE=DATE:20260702');
		expect(ics).toContain('LOCATION:Probebühne 1');
		expect(ics).toContain('UID:a@intranet.test');
		expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
	});
});
