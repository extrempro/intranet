/**
 * Rückmeldungen (Kap. 13): Fehler und Ideen mit Angabe der Seite.
 * - Ideen bearbeitet die Verwaltung des Mandanten; Rückfragen laufen über
 *   Nachrichten (Postfach „Verwaltung“).
 * - Fehler sehen nur System-Admins (IT): mit technischen Angaben aus dem
 *   Browser und freiwilligem Bildschirmfoto; Rückfragen als persönliches
 *   Gespräch. Das Bildschirmfoto wird 30 Tage nach Abschluss gelöscht.
 * Abgeschlossene Rückmeldungen werden nach der Löschfrist entfernt.
 */
import { and, desc, eq, inArray, isNotNull, lt, sql } from 'drizzle-orm';
import {
	FEEDBACK_STATUS,
	isFeedbackStatus,
	safeReturnPath,
	SCREENSHOT_MAX,
	SCREENSHOT_TAGE,
	validateFeedback,
	type FeedbackStatus,
	type FeedbackTechnik
} from '../feedback.ts';
import { audit } from './audit.ts';
import { canAdministerTenant, isSystemAdmin, type Principal } from './auth/access.ts';
import { db } from './db/index.ts';
import { conversations, feedback, persons, roleAssignments, tenants } from './db/schema.ts';
import { stripJpeg, JpegError } from './files/jpeg.ts';
import { deleteStored, storeBytes } from './files/store.ts';
import { detectKind } from './files/types.ts';
import { closeByRef, findConversation, roleMembers, startConversation } from './messages.ts';
import { notify } from './notify.ts';
import { getRetention } from './retention.ts';

export class FeedbackError extends Error {}

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Aktive System-Admins (Empfänger für Fehlermeldungen). */
async function systemAdmins(): Promise<string[]> {
	const rows = await db
		.selectDistinct({ id: roleAssignments.personId })
		.from(roleAssignments)
		.innerJoin(persons, eq(persons.id, roleAssignments.personId))
		.where(and(eq(roleAssignments.role, 'system_admin'), eq(persons.status, 'active')));
	return rows.map((r) => r.id);
}

/** Bildschirmfoto prüfen: nur JPEG, nicht zu groß, ohne Metadaten. */
function pruefeScreenshot(bytes: Uint8Array): Uint8Array {
	if (bytes.length === 0 || bytes.length > SCREENSHOT_MAX || detectKind(bytes) !== 'jpeg')
		throw new FeedbackError('Das Bildschirmfoto ist zu groß oder kein Bild.');
	try {
		return stripJpeg(bytes).data;
	} catch (err) {
		if (err instanceof JpegError) throw new FeedbackError('Das Bildschirmfoto ist beschädigt.');
		throw err;
	}
}

export async function createFeedback(
	p: Principal,
	input: { kind: string; text: string; page: string },
	fehler?: { technik: FeedbackTechnik; screenshot: Uint8Array | null }
): Promise<{ ok: true } | { ok: false; errors: { kind?: string; text?: string } }> {
	const errors = validateFeedback(input);
	if (Object.keys(errors).length) return { ok: false, errors };
	const istFehler = input.kind === 'fehler';
	let bild: Uint8Array | null = null;
	if (istFehler && fehler?.screenshot) {
		try {
			bild = pruefeScreenshot(fehler.screenshot);
		} catch (err) {
			if (err instanceof FeedbackError) return { ok: false, errors: { text: err.message } };
			throw err;
		}
	}
	const datei = bild
		? await storeBytes(bild, 'bildschirmfoto.jpg', 'jpeg', p.personId, 'rueckmeldungen')
		: null;
	let row: { id: string };
	try {
		[row] = await db
			.insert(feedback)
			.values({
				personId: p.personId,
				tenantId: p.tenantId,
				kind: istFehler ? 'fehler' : 'idee',
				text: input.text.trim(),
				page: safeReturnPath(input.page),
				technik: istFehler ? (fehler?.technik ?? null) : null,
				screenshotFileId: datei?.id ?? null
			})
			.returning({ id: feedback.id });
	} catch (err) {
		if (datei) await deleteStored([datei.id]);
		throw err;
	}
	await notify(
		'rueckmeldungen',
		istFehler ? await systemAdmins() : await roleMembers('verwaltung', p.tenantId),
		{
			title: istFehler ? 'Neue Rückmeldung: Fehler' : 'Neue Rückmeldung: Idee',
			detail: input.text.trim().slice(0, 80),
			link: `/verwaltung/rueckmeldungen/${row.id}`
		}
	);
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

export async function listFeedback(
	p: Principal,
	filter: { status?: string; kind?: string },
	limit = 200
) {
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
			tenant: tenants.shortName,
			gesamt: sql<number>`(count(*) over ())::int`
		})
		.from(feedback)
		.leftJoin(persons, eq(persons.id, feedback.personId))
		.innerJoin(tenants, eq(tenants.id, feedback.tenantId))
		.where(
			and(
				ids ? (ids.length ? inArray(feedback.tenantId, ids) : sql`false`) : undefined,
				// Fehler sehen nur System-Admins
				ids ? eq(feedback.kind, 'idee') : undefined,
				status ? eq(feedback.status, status) : undefined,
				offen ? inArray(feedback.status, ['neu', 'in_arbeit']) : undefined,
				kind ? eq(feedback.kind, kind) : undefined
			)
		)
		.orderBy(desc(feedback.createdAt), desc(feedback.id))
		.limit(Math.min(limit, 10000));
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
				ids ? eq(feedback.kind, 'idee') : undefined,
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
	if (
		!row ||
		!canAdministerTenant(p, row.f.tenantId) ||
		(row.f.kind === 'fehler' && !isSystemAdmin(p))
	)
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
	const subject = `Rückmeldung: ${row.f.text.slice(0, 60)}${row.f.text.length > 60 ? ' …' : ''}`;
	// Fehler: persönliches Gespräch mit dem System-Admin, nicht im Postfach
	// „Verwaltung“ des Mandanten (dort sollen Fehler nicht sichtbar sein)
	const convId =
		row.f.kind === 'fehler'
			? await startConversation({
					kind: 'rueckmeldung',
					subject,
					refId: id,
					memberIds: [...new Set([row.f.personId, p.personId])]
				})
			: await startConversation({
					kind: 'rueckmeldung',
					subject,
					refId: id,
					memberIds: [row.f.personId],
					roleBox: 'verwaltung',
					roleTenantId: row.f.tenantId
				});
	if (row.f.status === 'neu')
		await db.update(feedback).set({ status: 'in_arbeit' }).where(eq(feedback.id, id));
	return convId;
}

/**
 * Löschfristen (Kap. 15): Bildschirmfotos 30 Tage nach Abschluss, abgeschlossene
 * Rückmeldungen nach der eingestellten Frist (samt Bildschirmfoto).
 */
export async function feedbackRetention() {
	const alt = await db
		.select({ id: feedback.id, bild: feedback.screenshotFileId })
		.from(feedback)
		.where(
			and(
				isNotNull(feedback.screenshotFileId),
				isNotNull(feedback.closedAt),
				lt(feedback.closedAt, sql`now() - make_interval(days => ${SCREENSHOT_TAGE})`)
			)
		);
	if (alt.length) {
		await db
			.update(feedback)
			.set({ screenshotFileId: null })
			.where(
				inArray(
					feedback.id,
					alt.map((r) => r.id)
				)
			);
		await deleteStored(alt.map((r) => r.bild!));
	}
	const days = await getRetention('feedback_days');
	const weg = await db
		.delete(feedback)
		.where(
			and(
				isNotNull(feedback.closedAt),
				lt(feedback.closedAt, sql`now() - make_interval(days => ${days})`)
			)
		)
		.returning({ bild: feedback.screenshotFileId });
	await deleteStored(weg.map((r) => r.bild).filter((b): b is string => Boolean(b)));
}

/** Bildschirmfoto einer Fehlermeldung: nur System-Admins. */
export async function feedbackScreenshotAllowed(p: Principal, fileId: string): Promise<boolean> {
	if (!isSystemAdmin(p) || !GUID.test(fileId)) return false;
	const [row] = await db
		.select({ id: feedback.id })
		.from(feedback)
		.where(eq(feedback.screenshotFileId, fileId));
	return Boolean(row);
}
