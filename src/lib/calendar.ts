/**
 * Kalender (Kap. 8.8): Regeln und Formate, auf Server und im Browser nutzbar.
 * Tage sind YYYY-MM-DD, Uhrzeiten HH:MM in Berliner Zeit.
 */
import { addDays, WEEKDAYS, weekdayOf } from './canteen.ts';
import { berlinToDate } from './news.ts';

export interface EventInput {
	title: string;
	date: string;
	allDay: boolean;
	startTime: string;
	endTime: string;
	place: string;
	description: string;
}

export type EventErrors = Partial<Record<keyof EventInput | 'unitId' | 'targets', string>>;

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const ISO = /^\d{4}-\d{2}-\d{2}$/;

export const TITLE_MAX = 90;
export const PLACE_MAX = 120;
export const DESCRIPTION_MAX = 2000;

export function validateEvent(e: EventInput): EventErrors {
	const err: EventErrors = {};
	const t = e.title.trim();
	if (t.length < 3) err.title = 'Gib bitte einen Titel an.';
	else if (t.length > TITLE_MAX) err.title = `Der Titel darf höchstens ${TITLE_MAX} Zeichen haben.`;
	if (!ISO.test(e.date) || Number.isNaN(Date.parse(e.date))) err.date = 'Gib bitte ein Datum an.';
	if (!e.allDay) {
		if (!TIME.test(e.startTime))
			err.startTime = 'Gib bitte eine Uhrzeit an oder wähle „Ganztägig“.';
		if (e.endTime && !TIME.test(e.endTime)) err.endTime = 'Ungültige Uhrzeit.';
		else if (!err.startTime && e.endTime && e.endTime <= e.startTime)
			err.endTime = '„Bis“ muss nach „Von“ liegen.';
	}
	if (e.place.trim().length > PLACE_MAX)
		err.place = `Der Ort darf höchstens ${PLACE_MAX} Zeichen haben.`;
	if (e.description.trim().length > DESCRIPTION_MAX)
		err.description = `Die Beschreibung darf höchstens ${DESCRIPTION_MAX} Zeichen haben.`;
	return err;
}

/** „ganztägig“, „10:00–11:00“ oder „10:00“ */
export function timeLabel(e: {
	allDay: boolean;
	startTime: string | null;
	endTime: string | null;
}): string {
	if (e.allDay || !e.startTime) return 'ganztägig';
	return e.endTime ? `${e.startTime}–${e.endTime}` : e.startTime;
}

/** „Heute · Freitag, 20.11.“, „Morgen · …“ oder „Montag, 23.11.2026“ */
export function dayHeading(day: string, today: string): string {
	const [y, m, d] = day.split('-');
	const base = `${WEEKDAYS[weekdayOf(day)]}, ${d}.${m}.`;
	if (day === today) return `Heute · ${base}`;
	if (day === addDays(today, 1)) return `Morgen · ${base}`;
	return y === today.slice(0, 4) ? base : `${base}${y}`;
}

const MONTHS = [
	'Januar',
	'Februar',
	'März',
	'April',
	'Mai',
	'Juni',
	'Juli',
	'August',
	'September',
	'Oktober',
	'November',
	'Dezember'
];

export function isMonth(v: string | null): v is string {
	return !!v && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);
}

export function monthLabel(month: string): string {
	const [y, m] = month.split('-').map(Number);
	return `${MONTHS[m - 1]} ${y}`;
}

export function shiftMonth(month: string, delta: number): string {
	const [y, m] = month.split('-').map(Number);
	const d = new Date(Date.UTC(y, m - 1 + delta, 1));
	return d.toISOString().slice(0, 7);
}

/** Tage des Monatsrasters, Montag zuerst; null füllt Lücken. */
export function monthCells(month: string): (string | null)[] {
	const first = `${month}-01`;
	const cells: (string | null)[] = Array(weekdayOf(first)).fill(null);
	for (let d = first; d.startsWith(month); d = addDays(d, 1)) cells.push(d);
	while (cells.length % 7) cells.push(null);
	return cells;
}

// ---------------------------------------------------------------------------
// iCalendar (RFC 5545)
// ---------------------------------------------------------------------------

export interface IcsEvent {
	id: string;
	title: string;
	date: string;
	allDay: boolean;
	startTime: string | null;
	endTime: string | null;
	place: string | null;
	sender: string;
	description?: string | null;
	updatedAt: Date;
}

export function icsEscape(v: string): string {
	return v
		.replace(/\\/g, '\\\\')
		.replace(/;/g, '\\;')
		.replace(/,/g, '\\,')
		.replace(/\r?\n/g, '\\n');
}

/** Zeilen über 75 Byte falten (UTF-8-sicher). */
export function foldLine(line: string): string {
	const out: string[] = [];
	let cur = '';
	let bytes = 0;
	for (const ch of line) {
		const n = new TextEncoder().encode(ch).length;
		if (bytes + n > (out.length ? 74 : 75)) {
			out.push(cur);
			cur = '';
			bytes = 0;
		}
		cur += ch;
		bytes += n;
	}
	out.push(cur);
	return out.join('\r\n ');
}

const utc = (d: Date) =>
	d
		.toISOString()
		.replace(/[-:]/g, '')
		.replace(/\.\d{3}/, '');

/**
 * Kalenderdatei. Im Abo ohne Beschreibung (nur Titel, Zeit, Ort, Absender);
 * beim einzelnen Herunterladen nach Anmeldung mit Beschreibung.
 */
export function buildIcs(
	list: IcsEvent[],
	opts: { name: string; host: string; feed?: boolean }
): string {
	const lines = [
		'BEGIN:VCALENDAR',
		'VERSION:2.0',
		'PRODID:-//Intranet//Kalender//DE',
		'CALSCALE:GREGORIAN',
		'METHOD:PUBLISH',
		`X-WR-CALNAME:${icsEscape(opts.name)}`,
		'X-WR-TIMEZONE:Europe/Berlin',
		// Abo: alle 4 Stunden neu abrufen
		...(opts.feed ? ['REFRESH-INTERVAL;VALUE=DURATION:PT4H', 'X-PUBLISHED-TTL:PT4H'] : [])
	];
	for (const e of list) {
		lines.push('BEGIN:VEVENT', `UID:${e.id}@${opts.host}`, `DTSTAMP:${utc(e.updatedAt)}`);
		if (e.allDay || !e.startTime) {
			lines.push(
				`DTSTART;VALUE=DATE:${e.date.replace(/-/g, '')}`,
				`DTEND;VALUE=DATE:${addDays(e.date, 1).replace(/-/g, '')}`
			);
		} else {
			const start = berlinToDate(`${e.date}T${e.startTime}`)!;
			lines.push(`DTSTART:${utc(start)}`);
			if (e.endTime) lines.push(`DTEND:${utc(berlinToDate(`${e.date}T${e.endTime}`)!)}`);
		}
		lines.push(`SUMMARY:${icsEscape(e.title)}`);
		if (e.place) lines.push(`LOCATION:${icsEscape(e.place)}`);
		const desc = [`Absender: ${e.sender}`, e.description?.trim()].filter(Boolean).join('\n\n');
		lines.push(`DESCRIPTION:${icsEscape(desc)}`, 'END:VEVENT');
	}
	lines.push('END:VCALENDAR');
	return lines.map(foldLine).join('\r\n') + '\r\n';
}
