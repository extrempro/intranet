import { db } from './db/index.ts';
import { auditLog } from './db/schema.ts';
import { ipPrefix } from './net.ts';

export interface AuditEntry {
	category: 'admin' | 'security';
	action: string;
	actorId?: string | null;
	tenantId?: string | null;
	entityType?: string;
	entityId?: string;
	/** Nie Inhalte von Beiträgen, Passwörter, Tokens o. Ä. */
	details?: Record<string, unknown>;
	ip?: string | null;
}

/** Schreibt einen Protokolleintrag. Fehler beim Protokollieren brechen die Anfrage nicht ab. */
export async function audit(entry: AuditEntry): Promise<void> {
	try {
		await db.insert(auditLog).values({
			category: entry.category,
			action: entry.action,
			actorId: entry.actorId ?? null,
			tenantId: entry.tenantId ?? null,
			entityType: entry.entityType,
			entityId: entry.entityId,
			details: entry.details,
			ipPrefix: ipPrefix(entry.ip)
		});
	} catch (err) {
		console.error('Protokolleintrag fehlgeschlagen:', entry.action, err);
	}
}
