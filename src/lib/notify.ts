/**
 * Benachrichtigungen (Kap. 11): Themen, Voreinstellungen und Einstellungen
 * je Person. Vorerst Glocke und E-Mail; Web Push und Teams folgen mit dem
 * PWA-Schritt. Themen erscheinen erst, wenn es die Funktion gibt.
 */
export type Channel = 'bell' | 'email';
export type EmailMode = 'sofort' | 'taeglich' | 'woechentlich';

export interface TopicDefinition {
	key: string;
	label: string;
	hint?: string;
	defaults: Record<Channel, boolean>;
	/** Kanäle, die sich nicht abschalten lassen */
	fixed?: Channel[];
	/** Nur für Personen mit dieser Aufgabe sichtbar */
	onlyFor?: 'moderation' | 'pflege';
	/** Nicht in der Tabelle: Einstellung woanders (Hubs: „Meine Hubs“) */
	hidden?: boolean;
}

/** Reihenfolge und Voreinstellungen nach Tabelle 11.2 */
export const TOPICS: TopicDefinition[] = [
	{
		key: 'dringend',
		label: 'Dringende Meldungen',
		defaults: { bell: true, email: true },
		fixed: ['bell']
	},
	{ key: 'angeheftet', label: 'Angeheftete Beiträge', defaults: { bell: true, email: false } },
	{ key: 'neuigkeiten', label: 'Neuigkeiten', defaults: { bell: true, email: true } },
	{ key: 'kulissen', label: 'Hinter den Kulissen', defaults: { bell: true, email: false } },
	{
		key: 'speiseplan',
		label: 'Speiseplan',
		hint: 'eigener Standort',
		defaults: { bell: false, email: false }
	},
	{
		key: 'plaene',
		label: 'Pläne (KBB)',
		hint: 'KBB deines Mandanten',
		defaults: { bell: true, email: true }
	},
	{
		key: 'schwarzes_brett',
		label: 'Schwarzes Brett',
		hint: 'neue Anzeigen',
		defaults: { bell: false, email: false }
	},
	{ key: 'nachrichten', label: 'Nachrichten', defaults: { bell: true, email: true } },
	{
		key: 'moderation',
		label: 'Schwarzes Brett prüfen',
		hint: 'nur Moderation',
		defaults: { bell: true, email: true },
		onlyFor: 'moderation'
	},
	{
		key: 'pflege',
		label: 'Zuständigkeiten prüfen',
		hint: 'nur Pflege von Abteilungen',
		defaults: { bell: true, email: true },
		onlyFor: 'pflege'
	},
	{ key: 'hubs', label: 'Aus den Hubs', defaults: { bell: true, email: false }, hidden: true }
];

export type Topic = (typeof TOPICS)[number]['key'];

export interface NotifySettings {
	topics: Record<string, Partial<Record<Channel, boolean>>>;
	emailMode: EmailMode;
}

export const EMAIL_MODES: { key: EmailMode; label: string; hint: string }[] = [
	{ key: 'sofort', label: 'Sofort', hint: 'Jede Benachrichtigung einzeln' },
	{ key: 'taeglich', label: 'Täglich', hint: 'Gesammelt um 7 Uhr' },
	{ key: 'woechentlich', label: 'Wöchentlich', hint: 'Gesammelt montags um 7 Uhr' }
];

export function isTopic(key: string): boolean {
	return TOPICS.some((t) => t.key === key);
}

/** Gespeicherte Einstellung mit Voreinstellungen aufgefüllt; feste Kanäle immer an. */
export function resolveNotify(stored: NotifySettings | null | undefined): {
	topics: Record<string, Record<Channel, boolean>>;
	emailMode: EmailMode;
} {
	const topics: Record<string, Record<Channel, boolean>> = {};
	for (const t of TOPICS) {
		const s = stored?.topics?.[t.key] ?? {};
		topics[t.key] = {
			bell: t.fixed?.includes('bell') ? true : (s.bell ?? t.defaults.bell),
			email: t.fixed?.includes('email') ? true : (s.email ?? t.defaults.email)
		};
	}
	const mode = stored?.emailMode;
	return {
		topics,
		emailMode: mode && EMAIL_MODES.some((m) => m.key === mode) ? mode : 'taeglich'
	};
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
