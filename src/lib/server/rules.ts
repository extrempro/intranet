/**
 * Regeln für Inhalte (Kap. 14), in der Verwaltung einstellbar.
 * Fehlt die Einstellung, gelten die Standardwerte aus der Spezifikation.
 */
import { getSetting } from './settings.ts';

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
	responsibilityReviewMonths: 12
};

export async function getContentRules(): Promise<ContentRules> {
	const stored = await getSetting<Partial<ContentRules>>('regeln.inhalte', {});
	return { ...DEFAULT_RULES, ...stored };
}
