/**
 * Regelmäßiges Aufräumen nach den Löschfristen (Kap. 15), soweit es die
 * Daten aus Etappe 1 betrifft. Läuft stündlich im Anwendungsprozess.
 */
import { and, isNotNull, lt, or, sql } from 'drizzle-orm';
import { deleteExpiredSessions } from './auth/session.ts';
import { deleteOldResets } from './auth/reset.ts';
import { deleteOrphans } from './files/store.ts';
import { alteEntwuerfeLoeschen } from './entwuerfe.ts';
import { boardRetention } from './board.ts';
import { calendarRetention } from './calendar.ts';
import { hubRetention } from './hubs.ts';
import { feedbackRetention } from './feedback.ts';
import { deleteDisabledAccounts, deletePhotosOfDisabled } from './people.ts';
import { remindResponsibilityReviews } from './departments.ts';
import { deleteClosedConversations } from './messages.ts';
import { deleteExpiredCanteenData } from './canteen.ts';
import { deleteOldNotifications } from './notify.ts';
import { deleteForgottenPlans } from './plans.ts';
import { db } from './db/index.ts';
import { auditLog, invitations, pendingLogins } from './db/schema.ts';
import { allRetention } from './retention.ts';
import { track } from './jobs.ts';
import { alterFortschrittLoeschen } from './fortschritt.ts';
import { checkBackups } from './system.ts';

export async function cleanup(): Promise<void> {
	await deleteExpiredSessions();
	await deleteOldResets();
	await alteEntwuerfeLoeschen();
	await deleteOrphans();
	await deleteForgottenPlans();
	await deleteExpiredCanteenData();
	await calendarRetention();
	await deleteOldNotifications();
	await boardRetention();
	await hubRetention();
	await feedbackRetention();
	await deletePhotosOfDisabled();
	await remindResponsibilityReviews();
	await deleteClosedConversations();
	await alterFortschrittLoeschen();
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

	await deleteDisabledAccounts();
	const fristen = await allRetention();
	for (const [category, d] of [
		['admin', fristen.audit_admin_days],
		['security', fristen.audit_security_days]
	] as const) {
		await db
			.delete(auditLog)
			.where(
				and(
					sql`${auditLog.category} = ${category}`,
					lt(auditLog.at, sql`now() - make_interval(days => ${d})`)
				)
			);
	}
}

let timer: ReturnType<typeof setInterval> | null = null;

export function startCleanup(intervalMs = 60 * 60 * 1000) {
	if (timer) return;
	const run = async () => {
		await track('aufraeumen', cleanup).catch((err) =>
			console.error('Aufräumen fehlgeschlagen:', err)
		);
		await checkBackups().catch((err) =>
			console.error('Prüfung der Sicherung fehlgeschlagen:', err)
		);
	};
	void run();
	timer = setInterval(run, intervalMs);
	timer.unref();
}
