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
}

export const DEFAULT_RULES: ContentRules = {
	pinMaxDays: 14,
	pinPerSender: 1,
	pinEditorial: 3,
	pinShown: 3,
	urgentMaxDays: 3,
	urgentPerUnit: 1,
	writersMax: 10,
	reactions: ['👍', '❤️', '👏', '😂', '😮']
};

export async function getContentRules(): Promise<ContentRules> {
	const stored = await getSetting<Partial<ContentRules>>('regeln.inhalte', {});
	return { ...DEFAULT_RULES, ...stored };
}
