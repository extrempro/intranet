/**
 * Benachrichtigungen (Kap. 11): Themen, Voreinstellungen und Einstellungen
 * je Person. Glocke, Web Push, E-Mail und Teams (alle Themen, Voreinstellung wie Push). Themen
 * erscheinen erst, wenn es die Funktion gibt.
 */
import { berlinNow } from './canteen.ts';

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

export type Topic = (typeof TOPICS)[number]['key'];

/** Ruhezeiten (Kap. 11.3): keine Push-Nachrichten, danach gesammelt. */
export interface QuietHours {
	on: boolean;
	/** Beginn und Ende werktags (Mo–Fr), „HH:MM“ */
	start: string;
	end: string;
	/** Samstag und Sonntag ganztägig ruhig */
	weekend: boolean;
	/** Dringende Meldungen trotzdem sofort (Kap. 8.2) */
	urgent: boolean;
}

export const DEFAULT_QUIET: QuietHours = {
	on: true,
	start: '20:00',
	end: '07:00',
	weekend: true,
	urgent: true
};

/** Kanäle je Thema; Teams für alle sichtbaren Themen, voreingestellt wie Push */
export type TopicChannels = Record<Channel, boolean> & { teams: boolean };

export interface NotifySettings {
	topics: Record<string, Partial<Record<Channel | 'teams', boolean>>>;
	emailMode: EmailMode;
	quiet?: QuietHours;
}

export const EMAIL_MODES: { key: EmailMode; label: string; hint: string }[] = [
	{ key: 'sofort', label: 'Sofort', hint: 'Jede Benachrichtigung einzeln' },
	{ key: 'taeglich', label: 'Täglich', hint: 'Gesammelt um 7 Uhr' },
	{ key: 'woechentlich', label: 'Wöchentlich', hint: 'Gesammelt montags um 7 Uhr' }
];

export function isTopic(key: string): boolean {
	return TOPICS.some((t) => t.key === key);
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Gespeicherte Einstellung mit Voreinstellungen aufgefüllt; feste Kanäle immer an. */
export function resolveNotify(stored: NotifySettings | null | undefined): {
	topics: Record<string, TopicChannels>;
	emailMode: EmailMode;
	quiet: QuietHours;
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
	const q = stored?.quiet;
	return {
		topics,
		emailMode: mode && EMAIL_MODES.some((m) => m.key === mode) ? mode : 'taeglich',
		quiet: {
			on: typeof q?.on === 'boolean' ? q.on : DEFAULT_QUIET.on,
			start: q?.start && TIME.test(q.start) ? q.start : DEFAULT_QUIET.start,
			end: q?.end && TIME.test(q.end) ? q.end : DEFAULT_QUIET.end,
			weekend: typeof q?.weekend === 'boolean' ? q.weekend : DEFAULT_QUIET.weekend,
			urgent: typeof q?.urgent === 'boolean' ? q.urgent : DEFAULT_QUIET.urgent
		}
	};
}

/** Ist zu diesem Zeitpunkt (Berliner Zeit) Ruhezeit? weekday: 0 = Montag … 6 = Sonntag. */
export function isQuiet(at: { weekday: number; time: string }, q: QuietHours): boolean {
	if (!q.on) return false;
	if (q.weekend && at.weekday >= 5) return true;
	if (q.start === q.end) return false;
	return q.start > q.end
		? at.time >= q.start || at.time < q.end
		: at.time >= q.start && at.time < q.end;
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
