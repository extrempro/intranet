/**
 * Speiseplan und Standorte (Kap. 8.7): Regeln, die auf Server und im Browser
 * gelten. Tage sind immer YYYY-MM-DD in Berliner Zeit.
 */
import { formatRange } from './plans.ts';

export interface OpeningDay {
	open: boolean;
	from: string;
	to: string;
}

export const WEEKDAYS = [
	'Montag',
	'Dienstag',
	'Mittwoch',
	'Donnerstag',
	'Freitag',
	'Samstag',
	'Sonntag'
] as const;

export const ANNOUNCE_OPTIONS = [0, 3, 7, 14] as const;

export function defaultHours(): OpeningDay[] {
	return WEEKDAYS.map((_, i) => ({ open: i < 5, from: '11:30', to: '14:00' }));
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(v: string): boolean {
	return ISO.test(v) && !Number.isNaN(Date.parse(v));
}

/** Prüft die Öffnungszeiten; liefert eine Meldung oder null. */
export function checkHours(days: OpeningDay[]): string | null {
	if (days.length !== 7) return 'Die Öffnungszeiten sind unvollständig.';
	for (const [i, d] of days.entries()) {
		if (!d.open) continue;
		if (!TIME.test(d.from) || !TIME.test(d.to)) return `${WEEKDAYS[i]}: Gib bitte Uhrzeiten an.`;
		if (d.to <= d.from) return `${WEEKDAYS[i]}: „bis“ muss nach „von“ liegen.`;
	}
	return null;
}

/** Jetzt in Berlin: Tag, Wochentag (0 = Montag) und Uhrzeit HH:MM. */
export function berlinNow(now = new Date()): { date: string; weekday: number; time: string } {
	const parts = Object.fromEntries(
		new Intl.DateTimeFormat('en-GB', {
			timeZone: 'Europe/Berlin',
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			weekday: 'short',
			hour: '2-digit',
			minute: '2-digit',
			hourCycle: 'h23'
		})
			.formatToParts(now)
			.map((p) => [p.type, p.value])
	);
	const weekday = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(parts.weekday);
	return {
		date: `${parts.year}-${parts.month}-${parts.day}`,
		weekday,
		time: `${parts.hour}:${parts.minute}`
	};
}

/** Tag ± n Tage (YYYY-MM-DD). */
export function addDays(day: string, n: number): string {
	const d = new Date(`${day}T00:00:00Z`);
	d.setUTCDate(d.getUTCDate() + n);
	return d.toISOString().slice(0, 10);
}

/** Wochentag eines Tages, 0 = Montag. */
export function weekdayOf(day: string): number {
	return (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7;
}

/** „Freitag, 27.11.“ */
export function dayLabel(day: string): string {
	const [, m, d] = day.split('-');
	return `${WEEKDAYS[weekdayOf(day)]}, ${d}.${m}.`;
}

export interface Closure {
	id?: string;
	fromDate: string;
	untilDate: string;
	reason: string | null;
	announceDays: number;
}

/** Überschrift im roten Hinweis, wie im Entwurf. */
export function closureTitle(c: Pick<Closure, 'fromDate' | 'untilDate'>): string {
	return c.fromDate === c.untilDate
		? `Geschlossen am ${dayLabel(c.untilDate)}`
		: `Geschlossen bis ${dayLabel(c.untilDate)}`;
}

export function closureRange(c: Pick<Closure, 'fromDate' | 'untilDate' | 'reason'>): string {
	return formatRange(c.fromDate, c.untilDate) + (c.reason ? ` · ${c.reason}` : '');
}

/** Aktive Schließung heute und angekündigte künftige Schließungen. */
export function closureNotices<T extends Closure>(
	closures: T[],
	today: string
): { active: T | null; announced: T[] } {
	const sorted = [...closures].sort((a, b) => a.fromDate.localeCompare(b.fromDate));
	const active = sorted.find((c) => c.fromDate <= today && today <= c.untilDate) ?? null;
	const announced = sorted.filter(
		(c) => c.fromDate > today && c.announceDays > 0 && addDays(c.fromDate, -c.announceDays) <= today
	);
	return { active, announced };
}

/** Prüft eine Schließzeit; liefert Fehler je Feld. */
export function checkClosure(
	c: Closure,
	today: string
): Partial<Record<'fromDate' | 'untilDate' | 'reason' | 'announceDays', string>> {
	const e: Partial<Record<'fromDate' | 'untilDate' | 'reason' | 'announceDays', string>> = {};
	if (!isIsoDate(c.fromDate)) e.fromDate = 'Gib bitte „Von“ an.';
	if (!isIsoDate(c.untilDate)) e.untilDate = 'Gib bitte „Bis einschließlich“ an.';
	else if (!e.fromDate && c.untilDate < c.fromDate)
		e.untilDate = '„Bis“ darf nicht vor „Von“ liegen.';
	else if (c.untilDate < today) e.untilDate = 'Die Schließzeit liegt schon in der Vergangenheit.';
	if ((c.reason ?? '').length > 80) e.reason = 'Der Grund darf höchstens 80 Zeichen haben.';
	if (!(ANNOUNCE_OPTIONS as readonly number[]).includes(c.announceDays))
		e.announceDays = 'Ungültige Auswahl.';
	return e;
}

export type OpenState =
	{ open: true; text: string } | { open: false; text: string; closedNotice?: boolean };

/**
 * „Jetzt geöffnet bis 14:00“ bzw. „Jetzt geschlossen“ – mit Schließzeiten
 * und „Heute geschlossen“.
 */
export function openState(
	hours: OpeningDay[],
	now: { date: string; weekday: number; time: string },
	closedToday: boolean
): OpenState {
	if (closedToday) return { open: false, text: 'Heute geschlossen', closedNotice: true };
	const d = hours[now.weekday];
	if (!d?.open) return { open: false, text: 'Heute Ruhetag' };
	if (now.time < d.from) return { open: false, text: `Jetzt geschlossen · öffnet um ${d.from}` };
	if (now.time >= d.to) return { open: false, text: 'Jetzt geschlossen' };
	return { open: true, text: `Jetzt geöffnet bis ${d.to}` };
}

/** Kompakte Öffnungszeiten: gleiche aufeinanderfolgende Tage zusammengefasst. */
export function hoursSummary(hours: OpeningDay[]): { days: string; time: string }[] {
	const out: { days: string; time: string }[] = [];
	let start = 0;
	const key = (d: OpeningDay) => (d.open ? `${d.from}–${d.to}` : 'Ruhetag');
	for (let i = 1; i <= 7; i++) {
		if (i < 7 && key(hours[i]) === key(hours[start])) continue;
		const short = (n: number) => WEEKDAYS[n].slice(0, 2);
		out.push({
			days: i - 1 === start ? WEEKDAYS[start] : `${short(start)}–${short(i - 1)}`,
			time: key(hours[start])
		});
		start = i;
	}
	return out;
}

/** ISO-Kalenderwoche */
export function isoWeek(day: string): number {
	const d = new Date(`${day}T00:00:00Z`);
	const wd = (d.getUTCDay() + 6) % 7;
	d.setUTCDate(d.getUTCDate() - wd + 3);
	const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
	const fwd = (firstThursday.getUTCDay() + 6) % 7;
	firstThursday.setUTCDate(firstThursday.getUTCDate() - fwd + 3);
	return 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 86400000));
}

/** „Speiseplan KW 48“, bei mehr als einer Woche der Zeitraum. */
export function menuTitle(validFrom: string, validUntil: string): string {
	const sameWeek =
		isoWeek(validFrom) === isoWeek(validUntil) &&
		Date.parse(validUntil) - Date.parse(validFrom) < 7 * 86400000;
	return sameWeek
		? `Speiseplan KW ${isoWeek(validFrom)}`
		: `Speiseplan ${formatRange(validFrom, validUntil)}`;
}

export function checkMenuDates(
	validFrom: string,
	validUntil: string,
	today: string
): Partial<Record<'validFrom' | 'validUntil', string>> {
	const e: Partial<Record<'validFrom' | 'validUntil', string>> = {};
	if (!isIsoDate(validFrom)) e.validFrom = 'Gib bitte „Gültig von“ an.';
	if (!isIsoDate(validUntil)) e.validUntil = 'Gib bitte „Gültig bis“ an.';
	else if (!e.validFrom && validUntil < validFrom)
		e.validUntil = '„Gültig bis“ darf nicht vor „Gültig von“ liegen.';
	else if (validUntil < today) e.validUntil = '„Gültig bis“ liegt schon in der Vergangenheit.';
	else if (!e.validFrom && Date.parse(validUntil) - Date.parse(validFrom) > 62 * 86400000)
		e.validUntil = 'Ein Speiseplan gilt höchstens zwei Monate.';
	return e;
}
