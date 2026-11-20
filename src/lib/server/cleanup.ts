/**
 * Regelmäßiges Aufräumen nach den Löschfristen (Kap. 15), soweit es die
 * Daten aus Etappe 1 betrifft. Läuft stündlich im Anwendungsprozess.
 */
import { and, isNotNull, lt, or, sql } from 'drizzle-orm';
import { deleteExpiredSessions } from './auth/session.ts';
import { deleteOrphans } from './files/store.ts';
import { boardRetention } from './board.ts';
import { calendarRetention } from './calendar.ts';
import { hubRetention } from './hubs.ts';
import { deletePhotosOfDisabled } from './people.ts';
import { remindResponsibilityReviews } from './departments.ts';
import { deleteClosedConversations } from './messages.ts';
import { deleteExpiredCanteenData } from './canteen.ts';
import { deleteOldNotifications } from './notify.ts';
import { deleteForgottenPlans } from './plans.ts';
import { db } from './db/index.ts';
import { auditLog, invitations, pendingLogins } from './db/schema.ts';
import { getSetting } from './settings.ts';

/** Fristen in Tagen (Standardwerte aus Kap. 15). */
const AUDIT_DEFAULTS = { admin: 365, security: 30 };

export async function cleanup(): Promise<void> {
	await deleteExpiredSessions();
	await deleteOrphans();
	await deleteForgottenPlans();
	await deleteExpiredCanteenData();
	await calendarRetention();
	await deleteOldNotifications();
	await boardRetention();
	await hubRetention();
	await deletePhotosOfDisabled();
	await remindResponsibilityReviews();
	await deleteClosedConversations();
	await db.delete(pendingLogins).where(lt(pendingLogins.expiresAt, new Date()));
	// Abgelaufene oder benutzte Einladungslinks nach 30 Tagen entfernen
	await db
		.delete(invitations)
		.where(
			or(
				lt(invitations.expiresAt, sql`now() - interval '30 days'`),
				and(isNotNull(invitations.usedAt), lt(invitations.usedAt, sql`now() - interval '30 days'`))
			)
		);

	const days = await getSetting('retention.audit', AUDIT_DEFAULTS);
	for (const category of ['admin', 'security'] as const) {
		const d = Math.max(1, Number(days[category]) || AUDIT_DEFAULTS[category]);
		await db
			.delete(auditLog)
			.where(
				and(
					sql`${auditLog.category} = ${category}`,
					lt(auditLog.at, sql`now() - ${`${d} days`}::interval`)
				)
			);
	}
}

let timer: ReturnType<typeof setInterval> | null = null;

export function startCleanup(intervalMs = 60 * 60 * 1000) {
	if (timer) return;
	const run = () => cleanup().catch((err) => console.error('Aufräumen fehlgeschlagen:', err));
	void run();
	timer = setInterval(run, intervalMs);
	timer.unref();
}
