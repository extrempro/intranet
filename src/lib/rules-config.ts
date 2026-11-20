/**
 * Regeln für Inhalte (Kap. 14) und Löschfristen (Kap. 15): Beschreibung der
 * einstellbaren Werte mit Standard, Grenzen und Optionen. Rein und getestet;
 * gespeichert wird in der Tabelle settings (server/rules.ts, server/retention.ts).
 */

export interface ContentRules {
	pinMaxDays: number;
	pinPerSender: number;
	pinEditorial: number;
	pinShown: number;
	urgentMaxDays: number;
	urgentPerUnit: number;
	writersMax: number;
	reactions: string[];
	/** Kalender: Dürfen Abteilungen bzw. Hubs überhaupt Termine eintragen? Ausnahme je Einheit. */
	eventsDepartments: boolean;
	eventsHubs: boolean;
	/** Zuständigkeiten: Prüf-Erinnerung nach so vielen Monaten (Kap. 8.11) */
	responsibilityReviewMonths: number;
	/** Schwarzes Brett: gleichzeitig aktive Anzeigen je Person */
	boardMaxActive: number;
	/** Hub-Anträge: ohne Antwort auf eine Rückfrage geschlossen nach … Tagen */
	hubAnswerDays: number;
}

export const DEFAULT_RULES: ContentRules = {
	pinMaxDays: 14,
	pinPerSender: 1,
	pinEditorial: 3,
	pinShown: 3,
	urgentMaxDays: 3,
	urgentPerUnit: 1,
	writersMax: 10,
	reactions: ['👍', '❤️', '👏', '😂', '😮'],
	eventsDepartments: true,
	eventsHubs: true,
	responsibilityReviewMonths: 12,
	boardMaxActive: 3,
	hubAnswerDays: 30
};

type NumberKey = {
	[K in keyof ContentRules]: ContentRules[K] extends number ? K : never;
}[keyof ContentRules];
type BoolKey = {
	[K in keyof ContentRules]: ContentRules[K] extends boolean ? K : never;
}[keyof ContentRules];

export type RuleField =
	| {
			type: 'number';
			key: NumberKey;
			label: string;
			hint?: string;
			min: number;
			max: number;
			unit: string;
	  }
	| { type: 'bool'; key: BoolKey; label: string; hint?: string }
	| { type: 'reactions'; key: 'reactions'; label: string; hint?: string };

export const RULE_GROUPS: { id: string; title: string; fields: RuleField[] }[] = [
	{
		id: 'anheften',
		title: 'Anheften',
		fields: [
			{
				type: 'number',
				key: 'pinMaxDays',
				label: 'Höchstens angeheftet',
				min: 1,
				max: 60,
				unit: 'Tage'
			},
			{
				type: 'number',
				key: 'pinPerSender',
				label: 'Angeheftete Beiträge je Absender',
				min: 0,
				max: 5,
				unit: 'gleichzeitig'
			},
			{
				type: 'number',
				key: 'pinEditorial',
				label: 'Zusätzlich durch die Redaktion',
				min: 0,
				max: 10,
				unit: 'gleichzeitig'
			},
			{
				type: 'number',
				key: 'pinShown',
				label: 'Oben angezeigt',
				hint: 'Weitere angeheftete Beiträge erscheinen normal in der Liste.',
				min: 1,
				max: 10,
				unit: 'Beiträge'
			}
		]
	},
	{
		id: 'dringend',
		title: 'Dringende Meldungen',
		fields: [
			{
				type: 'number',
				key: 'urgentMaxDays',
				label: 'Höchstens dringend',
				min: 1,
				max: 14,
				unit: 'Tage'
			},
			{
				type: 'number',
				key: 'urgentPerUnit',
				label: 'Dringende Meldungen je Einheit',
				min: 1,
				max: 5,
				unit: 'gleichzeitig'
			}
		]
	},
	{
		id: 'schreibrechte',
		title: 'Schreibrechte',
		fields: [
			{
				type: 'number',
				key: 'writersMax',
				label: 'Personen mit Schreibrecht je Einheit',
				hint: 'Abteilungsverwaltung und Hub-Team zählen nicht mit.',
				min: 1,
				max: 50,
				unit: 'Personen'
			}
		]
	},
	{
		id: 'kalender',
		title: 'Kalender',
		fields: [
			{
				type: 'bool',
				key: 'eventsDepartments',
				label: 'Abteilungen dürfen Termine eintragen',
				hint: 'Ausnahmen stellst du je Einheit ein.'
			},
			{ type: 'bool', key: 'eventsHubs', label: 'Hubs dürfen Termine eintragen' }
		]
	},
	{
		id: 'zustaendigkeiten',
		title: 'Zuständigkeiten',
		fields: [
			{
				type: 'number',
				key: 'responsibilityReviewMonths',
				label: 'Prüf-Erinnerung nach',
				min: 3,
				max: 36,
				unit: 'Monaten'
			}
		]
	},
	{
		id: 'brett',
		title: 'Schwarzes Brett',
		fields: [
			{
				type: 'number',
				key: 'boardMaxActive',
				label: 'Aktive Anzeigen je Person',
				min: 1,
				max: 10,
				unit: 'gleichzeitig'
			}
		]
	},
	{
		id: 'hubs',
		title: 'Hub-Anträge',
		fields: [
			{
				type: 'number',
				key: 'hubAnswerDays',
				label: 'Ohne Antwort auf eine Rückfrage geschlossen nach',
				min: 7,
				max: 90,
				unit: 'Tagen'
			}
		]
	},
	{
		id: 'reaktionen',
		title: 'Reaktionen',
		fields: [
			{
				type: 'reactions',
				key: 'reactions',
				label: 'Erlaubte Reaktionen',
				hint: '1 bis 8 Emojis, mit Leerzeichen getrennt. Gespeichert wird nur „hat reagiert“.'
			}
		]
	}
];

/** Ein Emoji je Eintrag (auch mit Varianten und Hauttönen). */
const EMOJI = /^\p{Extended_Pictographic}(️|\p{Emoji_Modifier}|‍\p{Extended_Pictographic}️?)*$/u;

export function parseReactions(raw: string): string[] | null {
	const list = [...new Set(raw.split(/[\s,]+/).filter(Boolean))];
	if (list.length < 1 || list.length > 8) return null;
	return list.every((e) => EMOJI.test(e)) ? list : null;
}

/** Formularwerte prüfen; liefert vollständige Regeln oder Fehler je Feld. */
export function validateRules(form: Record<string, string | undefined>): {
	value?: ContentRules;
	errors: Record<string, string>;
} {
	const errors: Record<string, string> = {};
	const value = { ...DEFAULT_RULES } as ContentRules;
	for (const g of RULE_GROUPS)
		for (const f of g.fields) {
			const raw = form[f.key];
			if (f.type === 'number') {
				const n = Number(raw);
				if (!Number.isInteger(n) || n < f.min || n > f.max)
					errors[f.key] = `Bitte eine ganze Zahl von ${f.min} bis ${f.max}.`;
				else value[f.key] = n;
			} else if (f.type === 'bool') {
				value[f.key] = raw === 'on';
			} else {
				const list = parseReactions(raw ?? '');
				if (!list) errors[f.key] = 'Bitte 1 bis 8 einzelne Emojis.';
				else value.reactions = list;
			}
		}
	return Object.keys(errors).length ? { errors } : { value, errors };
}

// ---------------------------------------------------------------------------
// Löschfristen (Kap. 15)
// ---------------------------------------------------------------------------

export interface RetentionOption {
	value: number;
	label: string;
}

export interface RetentionField {
	key: string;
	label: string;
	hint?: string;
	default: number;
	options: RetentionOption[];
}

const d = (n: number, l: string) => ({ value: n, label: l });

/** Einstellbare Fristen; gespeichert als Zahl unter `retention.<key>`. */
export const RETENTION_FIELDS: RetentionField[] = [
	{
		key: 'board_days',
		label: 'Anzeigen am Schwarzen Brett',
		hint: 'nach Ablauf, Erledigt oder Ablehnung',
		default: 30,
		options: [d(0, 'sofort'), d(14, '14 Tage'), d(30, '30 Tage'), d(90, '90 Tage')]
	},
	{
		key: 'events_months',
		label: 'Vergangene Termine',
		default: 3,
		options: [d(1, '1 Monat'), d(3, '3 Monate'), d(12, '1 Jahr')]
	},
	{
		key: 'archived_hubs_years',
		label: 'Archivierte Hubs',
		default: 2,
		options: [d(1, '1 Jahr'), d(2, '2 Jahre'), d(3, '3 Jahre')]
	},
	{
		key: 'conversations_days',
		label: 'Geschlossene Gespräche',
		default: 90,
		options: [d(30, '30 Tage'), d(90, '90 Tage'), d(365, '1 Jahr')]
	},
	{
		key: 'hub_applications_days',
		label: 'Abgelehnte und geschlossene Hub-Anträge',
		default: 90,
		options: [d(30, '30 Tage'), d(90, '90 Tage'), d(365, '1 Jahr')]
	},
	{
		key: 'plans_months',
		label: 'Vergessene Pläne des KBB',
		hint: 'nach „Gültig bis“',
		default: 3,
		options: [d(1, '1 Monat'), d(3, '3 Monate'), d(6, '6 Monate'), d(12, '1 Jahr')]
	},
	{
		key: 'disabled_accounts_days',
		label: 'Deaktivierte Konten',
		hint: 'Inhalte gehören der Einheit und bleiben',
		default: 90,
		options: [d(30, '30 Tage'), d(90, '90 Tage'), d(180, '180 Tage')]
	},
	{
		key: 'feedback_days',
		label: 'Rückmeldungen',
		hint: 'nach Abschluss',
		default: 90,
		options: [d(30, '30 Tage'), d(90, '90 Tage'), d(365, '1 Jahr')]
	},
	{
		key: 'notifications_days',
		label: 'Benachrichtigungen (Glocke)',
		default: 90,
		options: [d(30, '30 Tage'), d(90, '90 Tage'), d(180, '180 Tage')]
	},
	{
		key: 'audit_admin_days',
		label: 'Protokoll der Verwaltung',
		default: 365,
		options: [d(182, '6 Monate'), d(365, '1 Jahr'), d(730, '2 Jahre'), d(1095, '3 Jahre')]
	},
	{
		key: 'audit_security_days',
		label: 'Anmeldeprotokoll (gekürzte IP)',
		default: 30,
		options: [d(7, '7 Tage'), d(30, '30 Tage'), d(90, '90 Tage')]
	}
];

/** Feste Fristen ohne Einstellung (nur zur Information). */
export const RETENTION_FIXED: { label: string; value: string }[] = [
	{ label: 'Speisepläne', value: 'am Tag nach „Gültig bis“' },
	{ label: 'Vereinbarungen', value: 'beim Ersetzen' },
	{ label: 'Dateien gelöschter Inhalte', value: 'sofort (Schlüssel wird vernichtet)' },
	{ label: 'Profilfotos', value: 'sofort bei Deaktivierung oder auf Wunsch' },
	{ label: 'Reaktionen', value: 'mit Beitrag bzw. Konto' },
	{ label: 'Sitzungen', value: 'sofort nach Ende' },
	{ label: 'Kalender-Abo-Links', value: 'nach 12 Monaten ohne Abruf' }
];

/** Gespeicherten Wert prüfen: nur erlaubte Optionen, sonst Standard. */
export function retentionValue(field: RetentionField, stored: unknown): number {
	const n = Number(stored);
	return field.options.some((o) => o.value === n) ? n : field.default;
}
