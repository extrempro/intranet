/**
 * Regeln für Inhalte (Kap. 14), in der Verwaltung einstellbar.
 * Fehlt die Einstellung, gelten die Standardwerte aus der Spezifikation.
 */
import { DEFAULT_RULES, type ContentRules } from '../rules-config.ts';
import { audit } from './audit.ts';
import { getSetting, setSetting } from './settings.ts';

export { DEFAULT_RULES, type ContentRules };

export async function getContentRules(): Promise<ContentRules> {
	const stored = await getSetting<Partial<ContentRules>>('regeln.inhalte', {});
	return { ...DEFAULT_RULES, ...stored };
}

/** Speichern (nur System-Admins, prüft der Aufrufer); protokolliert die Änderungen. */
export async function saveContentRules(rules: ContentRules, actorId: string, ip: string) {
	const before = await getContentRules();
	const changed = Object.fromEntries(
		(Object.keys(rules) as (keyof ContentRules)[])
			.filter((k) => JSON.stringify(before[k]) !== JSON.stringify(rules[k]))
			.map((k) => [k, { vorher: before[k], nachher: rules[k] }])
	);
	await setSetting('regeln.inhalte', rules, actorId);
	if (Object.keys(changed).length)
		await audit({
			category: 'admin',
			action: 'settings.rules',
			actorId,
			details: changed,
			ip
		});
}
