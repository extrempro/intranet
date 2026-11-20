/**
 * Rückmeldungen (Kap. 13): Fehler und Ideen mit Angabe der Seite. Die
 * Verwaltung des Mandanten bearbeitet sie; Rückfragen und Antworten laufen
 * über Nachrichten (Postfach „Verwaltung“). Abgeschlossene Rückmeldungen
 * werden nach der Löschfrist entfernt.
 */
import { and, desc, eq, inArray, isNotNull, lt, sql } from 'drizzle-orm';
import {
	FEEDBACK_STATUS,
	isFeedbackStatus,
	safeReturnPath,
	validateFeedback,
	type FeedbackStatus
} from '../feedback.ts';
import { audit } from './audit.ts';
import { canAdministerTenant, isSystemAdmin, type Principal } from './auth/access.ts';
import { db } from './db/index.ts';
import { conversations, feedback, persons, tenants } from './db/schema.ts';
import { closeByRef, findConversation, roleMembers, startConversation } from './messages.ts';
import { notify } from './notify.ts';
import { getRetention } from './retention.ts';

export class FeedbackError extends Error {}

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function createFeedback(
	p: Principal,
	input: { kind: string; text: string; page: string }
): Promise<{ ok: true } | { ok: false; errors: { kind?: string; text?: string } }> {
	const errors = validateFeedback(input);
	if (Object.keys(errors).length) return { ok: false, errors };
	const [row] = await db
		.insert(feedback)
		.values({
			personId: p.personId,
			tenantId: p.tenantId,
			kind: input.kind as 'fehler' | 'idee',
			text: input.text.trim(),
			page: safeReturnPath(input.page)
		})
		.returning({ id: feedback.id });
	await notify('rueckmeldungen', await roleMembers('verwaltung', p.tenantId), {
		title: input.kind === 'fehler' ? 'Neue Rückmeldung: Fehler' : 'Neue Rückmeldung: Idee',
		detail: input.text.trim().slice(0, 80),
		link: `/verwaltung/rueckmeldungen/${row.id}`
	});
	return { ok: true };
}

/** „Meine Meldungen“ mit Stand und Gespräch (falls es eine Rückfrage gab). */
export async function myFeedback(p: Principal) {
	const rows = await db
		.select()
		.from(feedback)
		.where(eq(feedback.personId, p.personId))
		.orderBy(desc(feedback.createdAt));
	const convs = rows.length
		? await db
				.select({ id: conversations.id, refId: conversations.refId })
				.from(conversations)
				.where(
					and(
						eq(conversations.kind, 'rueckmeldung'),
						inArray(
							conversations.refId,
							rows.map((r) => r.id)
						)
					)
				)
		: [];
	return rows.map((r) => ({
		id: r.id,
		kind: r.kind,
		text: r.text,
		page: r.page,
		status: r.status,
		statusLabel: FEEDBACK_STATUS[r.status],
		answer: r.answer,
		createdAt: r.createdAt,
		gespraech: convs.find((c) => c.refId === r.id)?.id ?? null
	}));
}

// ---------------------------------------------------------------------------
// Verwaltung
// ---------------------------------------------------------------------------

async function administrableTenantIds(p: Principal): Promise<string[] | null> {
	if (isSystemAdmin(p)) return null;
	const all = await db.select({ id: tenants.id }).from(tenants);
	return all.map((t) => t.id).filter((id) => canAdministerTenant(p, id));
}

export async function listFeedback(p: Principal, filter: { status?: string; kind?: string }) {
	const ids = await administrableTenantIds(p);
	const status = filter.status && isFeedbackStatus(filter.status) ? filter.status : null;
	const offen = filter.status === 'offen';
	const kind = filter.kind === 'fehler' || filter.kind === 'idee' ? filter.kind : null;
	const rows = await db
		.select({
			id: feedback.id,
			kind: feedback.kind,
			text: feedback.text,
			page: feedback.page,
			status: feedback.status,
			createdAt: feedback.createdAt,
			author: persons.displayName,
			tenant: tenants.shortName
		})
		.from(feedback)
		.leftJoin(persons, eq(persons.id, feedback.personId))
		.innerJoin(tenants, eq(tenants.id, feedback.tenantId))
		.where(
			and(
				ids ? (ids.length ? inArray(feedback.tenantId, ids) : sql`false`) : undefined,
				status ? eq(feedback.status, status) : undefined,
				offen ? inArray(feedback.status, ['neu', 'in_arbeit']) : undefined,
				kind ? eq(feedback.kind, kind) : undefined
			)
		)
		.orderBy(desc(feedback.createdAt))
		.limit(200);
	return rows.map((r) => ({ ...r, statusLabel: FEEDBACK_STATUS[r.status] }));
}

export async function openFeedbackCount(p: Principal) {
	const ids = await administrableTenantIds(p);
	const [{ n }] = await db
		.select({ n: sql<number>`count(*)::int` })
		.from(feedback)
		.where(
			and(
				ids ? (ids.length ? inArray(feedback.tenantId, ids) : sql`false`) : undefined,
				eq(feedback.status, 'neu')
			)
		);
	return n;
}

async function loadForAdmin(p: Principal, id: string) {
	if (!GUID.test(id)) throw new FeedbackError('Rückmeldung nicht gefunden.');
	const [row] = await db
		.select({ f: feedback, author: persons.displayName, tenant: tenants.name })
		.from(feedback)
		.leftJoin(persons, eq(persons.id, feedback.personId))
		.innerJoin(tenants, eq(tenants.id, feedback.tenantId))
		.where(eq(feedback.id, id));
	if (!row || !canAdministerTenant(p, row.f.tenantId))
		throw new FeedbackError('Rückmeldung nicht gefunden.');
	return row;
}

export async function getFeedback(p: Principal, id: string) {
	const row = await loadForAdmin(p, id).catch(() => null);
	if (!row) return null;
	const conv = await findConversation('rueckmeldung', id);
	return {
		...row.f,
		statusLabel: FEEDBACK_STATUS[row.f.status],
		author: row.author,
		tenant: row.tenant,
		gespraech: conv?.id ?? null
	};
}

export async function setFeedbackStatus(
	p: Principal,
	id: string,
	status: string,
	answer: string,
	ip: string
) {
	const row = await loadForAdmin(p, id);
	if (!isFeedbackStatus(status)) throw new FeedbackError('Unbekannter Stand.');
	const closed = status === 'erledigt' || status === 'abgelehnt';
	const text = answer.trim().slice(0, 1000) || null;
	await db
		.update(feedback)
		.set({ status, answer: text, closedAt: closed ? new Date() : null })
		.where(eq(feedback.id, id));
	if (closed) await closeByRef(id);
	await audit({
		category: 'admin',
		action: 'feedback.status',
		actorId: p.personId,
		tenantId: row.f.tenantId,
		entityType: 'feedback',
		entityId: id,
		details: { vorher: row.f.status, nachher: status },
		ip
	});
	if (row.f.personId && status !== row.f.status && status !== 'neu')
		await notify('nachrichten', [row.f.personId], {
			title: `Deine Rückmeldung: ${FEEDBACK_STATUS[status as FeedbackStatus]}`,
			detail: row.f.text.slice(0, 80),
			link: '/rueckmeldung'
		});
}

/** Rückfrage über Nachrichten (Postfach „Verwaltung“ des Mandanten). */
export async function askReporter(p: Principal, id: string): Promise<string> {
	const row = await loadForAdmin(p, id);
	if (!row.f.personId) throw new FeedbackError('Das Konto gibt es nicht mehr.');
	const existing = await findConversation('rueckmeldung', id, row.f.personId);
	if (existing && !existing.closedAt) return existing.id;
	const convId = await startConversation({
		kind: 'rueckmeldung',
		subject: `Rückmeldung: ${row.f.text.slice(0, 60)}${row.f.text.length > 60 ? ' …' : ''}`,
		refId: id,
		memberIds: [row.f.personId],
		roleBox: 'verwaltung',
		roleTenantId: row.f.tenantId
	});
	if (row.f.status === 'neu')
		await db.update(feedback).set({ status: 'in_arbeit' }).where(eq(feedback.id, id));
	return convId;
}

/** Abgeschlossene Rückmeldungen nach der Frist löschen (Kap. 15). */
export async function feedbackRetention() {
	const days = await getRetention('feedback_days');
	await db
		.delete(feedback)
		.where(
			and(
				isNotNull(feedback.closedAt),
				lt(feedback.closedAt, sql`now() - make_interval(days => ${days})`)
			)
		);
}
