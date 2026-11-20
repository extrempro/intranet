/**
 * Löschfristen (Kap. 15): gespeichert als `retention.<key>`; nur erlaubte
 * Optionen gelten, sonst der Standard.
 */
import { RETENTION_FIELDS, retentionValue } from '../rules-config.ts';
import { audit } from './audit.ts';
import { db } from './db/index.ts';
import { settings } from './db/schema.ts';
import { inArray } from 'drizzle-orm';
import { setSetting } from './settings.ts';

export type RetentionKey =
	| 'board_days'
	| 'events_months'
	| 'archived_hubs_years'
	| 'conversations_days'
	| 'hub_applications_days'
	| 'plans_months'
	| 'disabled_accounts_days'
	| 'notifications_days'
	| 'audit_admin_days'
	| 'audit_security_days';

export async function allRetention(): Promise<Record<string, number>> {
	const rows = await db
		.select({ key: settings.key, value: settings.value })
		.from(settings)
		.where(
			inArray(
				settings.key,
				RETENTION_FIELDS.map((f) => `retention.${f.key}`)
			)
		);
	return Object.fromEntries(
		RETENTION_FIELDS.map((f) => [
			f.key,
			retentionValue(f, rows.find((r) => r.key === `retention.${f.key}`)?.value)
		])
	);
}

export async function getRetention(key: RetentionKey): Promise<number> {
	return (await allRetention())[key];
}

/** Nur gültige Optionen werden gespeichert; liefert Fehler je Feld. */
export async function saveRetention(
	form: Record<string, string | undefined>,
	actorId: string,
	ip: string
): Promise<Record<string, string>> {
	const errors: Record<string, string> = {};
	const before = await allRetention();
	const next: Record<string, number> = {};
	for (const f of RETENTION_FIELDS) {
		const n = Number(form[f.key]);
		if (!f.options.some((o) => o.value === n)) errors[f.key] = 'Bitte eine der Optionen wählen.';
		else next[f.key] = n;
	}
	if (Object.keys(errors).length) return errors;
	const changed: Record<string, unknown> = {};
	for (const f of RETENTION_FIELDS)
		if (next[f.key] !== before[f.key]) {
			await setSetting(`retention.${f.key}`, next[f.key], actorId);
			changed[f.key] = { vorher: before[f.key], nachher: next[f.key] };
		}
	if (Object.keys(changed).length)
		await audit({ category: 'admin', action: 'settings.retention', actorId, details: changed, ip });
	return {};
}
