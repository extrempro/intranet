/**
 * Benachrichtigungen (Kap. 11): Themen, Voreinstellungen und Einstellungen
 * je Person. Glocke, Web Push, E-Mail und Teams (alle Themen, Voreinstellung wie Push). Themen
 * erscheinen erst, wenn es die Funktion gibt.
 */
import { addDays, berlinNow } from './canteen.ts';

export type Channel = 'bell' | 'push' | 'email';
export const CHANNELS: Channel[] = ['bell', 'push', 'email'];
export type EmailMode = 'sofort' | 'taeglich' | 'woechentlich';

export interface TopicDefinition {
	key: string;
	label: string;
	hint?: string;
	defaults: Record<Channel, boolean>;
	/** Kanäle, die sich nicht abschalten lassen */
	fixed?: Channel[];
	/** Nur für Personen mit dieser Aufgabe sichtbar */
	onlyFor?: 'moderation' | 'pflege' | 'verwaltung' | 'system';
	/** Nicht in der Tabelle: Einstellung woanders (Hubs: „Meine Hubs“) */
	hidden?: boolean;
}

/** Reihenfolge und Voreinstellungen nach Tabelle 11.2 */
export const TOPICS: TopicDefinition[] = [
	{
		key: 'dringend',
		label: 'Dringende Meldungen',
		defaults: { bell: true, push: true, email: true },
		fixed: ['bell', 'push']
	},
	{
		key: 'angeheftet',
		label: 'Angeheftete Beiträge',
		defaults: { bell: true, push: true, email: false }
	},
	{ key: 'neuigkeiten', label: 'Neuigkeiten', defaults: { bell: true, push: false, email: true } },
	{
		key: 'intern',
		label: 'Intern aus deiner Abteilung',
		hint: 'nur für dein Team',
		defaults: { bell: true, push: true, email: false }
	},
	{
		key: 'kulissen',
		label: 'Hinter den Kulissen',
		defaults: { bell: true, push: false, email: false }
	},
	{
		key: 'speiseplan',
		label: 'Speiseplan',
		hint: 'eigener Standort',
		defaults: { bell: false, push: false, email: false }
	},
	{
		key: 'plaene',
		label: 'Pläne (KBB)',
		hint: 'KBB deines Mandanten',
		defaults: { bell: true, push: false, email: true }
	},
	{
		key: 'schwarzes_brett',
		label: 'Schwarzes Brett',
		hint: 'neue Anzeigen',
		defaults: { bell: false, push: false, email: false }
	},
	{
		key: 'vereinbarungen',
		label: 'Vereinbarungen',
		hint: 'neue und ersetzte Fassungen',
		defaults: { bell: true, push: false, email: false }
	},
	{ key: 'nachrichten', label: 'Nachrichten', defaults: { bell: true, push: true, email: true } },
	{
		key: 'moderation',
		label: 'Schwarzes Brett prüfen',
		hint: 'nur Moderation',
		defaults: { bell: true, push: true, email: true },
		onlyFor: 'moderation'
	},
	{
		key: 'pflege',
		label: 'Zuständigkeiten prüfen',
		hint: 'nur Pflege von Abteilungen',
		defaults: { bell: true, push: false, email: true },
		onlyFor: 'pflege'
	},
	{
		key: 'rueckmeldungen',
		label: 'Neue Rückmeldungen',
		hint: 'nur Verwaltung',
		defaults: { bell: true, push: false, email: false },
		onlyFor: 'verwaltung'
	},
	{
		key: 'system',
		label: 'Betrieb und Sicherungen',
		hint: 'nur System-Admins',
		defaults: { bell: true, push: false, email: true },
		onlyFor: 'system'
	},
	{
		key: 'hubs',
		label: 'Aus den Hubs',
		defaults: { bell: true, push: false, email: false },
		hidden: true
	}
];

/** Art der Ruhe an einem Wochentag */
export type QuietArt = 'zeit' | 'ganztags' | 'keine';

/**
 * Ruhe an einem Wochentag. Bei „zeit“ ist es ruhig zwischen `start` und `end`
 * dieses Tages; liegt `start` nach `end` (z. B. 20:00 bis 07:00), ist es morgens
 * bis `end` und abends ab `start` ruhig.
 */
export interface QuietDay {
	art: QuietArt;
	start: string;
	end: string;
}

/** Ruhezeiten (Kap. 11.3): keine Push-Nachrichten, danach gesammelt. */
export interface QuietHours {
	on: boolean;
	/** Montag (0) bis Sonntag (6) */
	days: QuietDay[];
	/** Dringende Meldungen trotzdem sofort (Kap. 8.2) */
	urgent: boolean;
}

/** Gespeicherte Form; ältere Einstellungen haben statt `days` nur start/end/weekend */
export interface StoredQuiet {
	on?: boolean;
	days?: Partial<QuietDay>[];
	start?: string;
	end?: string;
	weekend?: boolean;
	urgent?: boolean;
}

export const WOCHENTAGE = [
	'Montag',
	'Dienstag',
	'Mittwoch',
	'Donnerstag',
	'Freitag',
	'Samstag',
	'Sonntag'
] as const;

const werktag = (start: string, end: string): QuietDay => ({ art: 'zeit', start, end });
const ganztags = (start: string, end: string): QuietDay => ({ art: 'ganztags', start, end });

export const DEFAULT_QUIET: QuietHours = {
	on: true,
	days: [
		...Array.from({ length: 5 }, () => werktag('20:00', '07:00')),
		ganztags('20:00', '07:00'),
		ganztags('20:00', '07:00')
	],
	urgent: true
};

/** Kanäle je Thema; Teams für alle sichtbaren Themen, voreingestellt wie Push */
export type TopicChannels = Record<Channel, boolean> & { teams: boolean };

/**
 * Abwesenheit (Kap. 11.3), z. B. Urlaub: Tage einschließlich, Berliner Zeit.
 * Kein Push, keine Teams-Nachricht und keine E-Mail; danach gesammelt.
 * Nur für die Person selbst, nirgends für andere sichtbar.
 */
export interface Absence {
	from: string;
	to: string;
	/** Dringende Meldungen auch während der Abwesenheit */
	urgent: boolean;
}

export interface NotifySettings {
	topics: Record<string, Partial<Record<Channel | 'teams', boolean>>>;
	emailMode: EmailMode;
	quiet?: StoredQuiet;
	absence?: Partial<Absence> | null;
}

export const EMAIL_MODES: { key: EmailMode; label: string; hint: string }[] = [
	{ key: 'sofort', label: 'Sofort', hint: 'Jede Benachrichtigung einzeln' },
	{ key: 'taeglich', label: 'Täglich', hint: 'Gesammelt um 7 Uhr' },
	{ key: 'woechentlich', label: 'Wöchentlich', hint: 'Gesammelt montags um 7 Uhr' }
];

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Gespeicherte Einstellung mit Voreinstellungen aufgefüllt; feste Kanäle immer an. */
export function resolveNotify(stored: NotifySettings | null | undefined): {
	topics: Record<string, TopicChannels>;
	emailMode: EmailMode;
	quiet: QuietHours;
	absence: Absence | null;
} {
	const topics: Record<string, TopicChannels> = {};
	for (const t of TOPICS) {
		const s = stored?.topics?.[t.key] ?? {};
		const pick = (c: Channel) => (t.fixed?.includes(c) ? true : (s[c] ?? t.defaults[c]));
		topics[t.key] = {
			bell: pick('bell'),
			push: pick('push'),
			email: pick('email'),
			// Hubs haben eigene Kanäle (Meine Hubs), dort kein Teams
			teams: t.hidden ? false : (s.teams ?? t.defaults.push)
		};
	}
	const mode = stored?.emailMode;
	return {
		topics,
		emailMode: mode && EMAIL_MODES.some((m) => m.key === mode) ? mode : 'taeglich',
		quiet: resolveQuiet(stored?.quiet),
		absence: resolveAbsence(stored?.absence)
	};
}

const TAG = /^\d{4}-\d{2}-\d{2}$/;

/** Abwesenheit prüfen: gültige Tage, Ende nicht vor Beginn, höchstens ein Jahr */
export function resolveAbsence(a: Partial<Absence> | null | undefined): Absence | null {
	if (!a || typeof a.from !== 'string' || typeof a.to !== 'string') return null;
	if (!TAG.test(a.from) || !TAG.test(a.to) || a.to < a.from) return null;
	if (addDays(a.from, 366) < a.to) return null;
	return { from: a.from, to: a.to, urgent: a.urgent === true };
}

/** Ist die Person an diesem Tag (Berliner Zeit) abwesend? */
export function isAbsent(today: string, a: Absence | null): boolean {
	return Boolean(a && a.from <= today && today <= a.to);
}

/** Mitternacht (Berliner Zeit) am Beginn dieses Tages als Zeitpunkt */
export function berlinMitternacht(day: string): Date {
	const [y, m, d] = day.split('-').map(Number);
	for (const stunden of [1, 2]) {
		const t = new Date(Date.UTC(y, m - 1, d, 0, 0) - stunden * 3_600_000);
		const b = berlinNow(t);
		if (b.date === day && b.time === '00:00') return t;
	}
	return new Date(Date.UTC(y, m - 1, d, 0, 0) - 3_600_000);
}

/**
 * Wann Push und Teams zugestellt werden (null = sofort): nach der Abwesenheit,
 * dann nach einer gerade laufenden Ruhezeit.
 */
export function deliverAfter(
	topic: string,
	now: Date,
	s: { quiet: QuietHours; absence: Absence | null }
): Date | null {
	const dringend = topic === 'dringend';
	if (isAbsent(berlinNow(now).date, s.absence) && !(dringend && s.absence?.urgent)) {
		const zurueck = berlinMitternacht(addDays((s.absence as Absence).to, 1));
		return dringend && s.quiet.urgent ? zurueck : (quietUntil(zurueck, s.quiet) ?? zurueck);
	}
	if (dringend && s.quiet.urgent) return null;
	return quietUntil(now, s.quiet);
}

/** Ruhezeiten mit Voreinstellungen auffüllen; ältere Form (start/end/weekend) übernehmen */
export function resolveQuiet(q: StoredQuiet | null | undefined): QuietHours {
	const zeit = (t: unknown, d: string) => (typeof t === 'string' && TIME.test(t) ? t : d);
	const art = (a: unknown, d: QuietArt): QuietArt =>
		a === 'zeit' || a === 'ganztags' || a === 'keine' ? a : d;
	let days: QuietDay[];
	if (Array.isArray(q?.days) && q.days.length === 7) {
		days = q.days.map((d, i) => ({
			art: art(d?.art, DEFAULT_QUIET.days[i].art),
			start: zeit(d?.start, DEFAULT_QUIET.days[i].start),
			end: zeit(d?.end, DEFAULT_QUIET.days[i].end)
		}));
	} else {
		// Ältere Form: dieselben Zeiten jeden Tag, am Wochenende auf Wunsch ganztägig
		const start = zeit(q?.start, '20:00');
		const end = zeit(q?.end, '07:00');
		const wochenende = typeof q?.weekend === 'boolean' ? q.weekend : true;
		days = WOCHENTAGE.map((_, i) =>
			i >= 5 && wochenende ? ganztags(start, end) : werktag(start, end)
		);
	}
	return {
		on: typeof q?.on === 'boolean' ? q.on : DEFAULT_QUIET.on,
		days,
		urgent: typeof q?.urgent === 'boolean' ? q.urgent : DEFAULT_QUIET.urgent
	};
}

/** Ist zu diesem Zeitpunkt (Berliner Zeit) Ruhezeit? weekday: 0 = Montag … 6 = Sonntag. */
export function isQuiet(at: { weekday: number; time: string }, q: QuietHours): boolean {
	if (!q.on) return false;
	const d = q.days[at.weekday];
	if (!d || d.art === 'keine') return false;
	if (d.art === 'ganztags') return true;
	if (d.start === d.end) return false;
	return d.start > d.end
		? at.time >= d.start || at.time < d.end
		: at.time >= d.start && at.time < d.end;
}

/** Kurzbeschreibung eines Tages, z. B. „20:00–07:00 Uhr“ */
export function tagText(d: QuietDay): string {
	if (d.art === 'keine' || (d.art === 'zeit' && d.start === d.end)) return 'keine Ruhe';
	if (d.art === 'ganztags') return 'ganztägig';
	return d.start > d.end ? `bis ${d.end} und ab ${d.start} Uhr` : `${d.start} bis ${d.end} Uhr`;
}

/** Zusammenfassung in einem Satz; gleiche Tage hintereinander werden zusammengefasst */
export function ruheText(q: QuietHours): string {
	if (!q.on) return 'Zurzeit: keine Ruhezeiten. Push und Teams kommen sofort.';
	const kurz = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
	const teile: string[] = [];
	let i = 0;
	while (i < 7) {
		const t = tagText(q.days[i]);
		let j = i;
		while (j + 1 < 7 && tagText(q.days[j + 1]) === t) j++;
		teile.push(`${i === j ? kurz[i] : `${kurz[i]}–${kurz[j]}`} ${t}`);
		i = j + 1;
	}
	return `Zurzeit: ${teile.join(', ')}. ${
		q.urgent
			? 'Dringende Meldungen kommen trotzdem sofort.'
			: 'Auch dringende Meldungen warten bis zum Ende der Ruhezeit.'
	}`;
}

/**
 * Ende der Ruhezeit ab `now` (null = jetzt keine Ruhezeit). Gesucht wird
 * minutengenau, höchstens 4 Tage weit; Sommer-/Winterzeit ergibt sich aus der
 * Umrechnung nach Berliner Zeit.
 */
export function quietUntil(now: Date, q: QuietHours): Date | null {
	if (!isQuiet(berlinNow(now), q)) return null;
	const step = 60_000;
	let t = Math.ceil(now.getTime() / step) * step;
	for (let i = 0; i < 4 * 24 * 60; i++, t += step) {
		if (!isQuiet(berlinNow(new Date(t)), q)) return new Date(t);
	}
	return new Date(t);
}

/**
 * Welche Zusammenfassungen sind jetzt fällig? Einmal am Tag ab 7 Uhr (Berlin):
 * täglich immer, wöchentlich nur montags.
 */
export function digestModesDue(
	now: { date: string; weekday: number; time: string },
	lastRunDay: string | null
): EmailMode[] {
	if (now.time < '07:00' || lastRunDay === now.date) return [];
	return now.weekday === 0 ? ['taeglich', 'woechentlich'] : ['taeglich'];
}
