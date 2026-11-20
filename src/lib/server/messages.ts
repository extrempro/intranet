/**
 * Nachrichten (Kap. 9): nur Gespräche zu Vorgängen, keine freien Nachrichten.
 * Postfächer: persönlich und gemeinsam je Rolle (vorerst Moderation
 * Schwarzes Brett je Mandant). Alle mit der Rolle sehen dieselben Gespräche.
 */
import { and, asc, desc, eq, inArray, isNotNull, isNull, lt, or, sql } from 'drizzle-orm';
import { hasTenantRole, type Principal } from './auth/access.ts';
import { db } from './db/index.ts';
import {
	conversationMembers,
	conversationReads,
	conversations,
	messages,
	persons,
	roleAssignments,
	tenants
} from './db/schema.ts';
import { notify } from './notify.ts';
import { getSetting } from './settings.ts';

export class MessageError extends Error {}

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const MESSAGE_MAX = 1000;

const KIND_LABEL = { anzeige: 'Anzeige', moderation: 'Moderation' } as const;

// ---------------------------------------------------------------------------
// Rollen-Postfächer
// ---------------------------------------------------------------------------

/** Mandanten, deren Schwarzes Brett die Person moderiert. */
export async function moderatedTenants(p: Principal) {
	const all = await db
		.select({ id: tenants.id, name: tenants.name, short: tenants.shortName })
		.from(tenants)
		.orderBy(asc(tenants.name));
	return all.filter((t) => hasTenantRole(p, 'moderation_schwarzes_brett', t.id));
}

/** Personen mit der Rolle Moderation für den Mandanten (für Benachrichtigungen). */
export async function moderatorsOf(tenantId: string): Promise<string[]> {
	const rows = await db
		.selectDistinct({ id: roleAssignments.personId })
		.from(roleAssignments)
		.where(
			and(
				eq(roleAssignments.role, 'moderation_schwarzes_brett'),
				or(
					eq(roleAssignments.scope, 'all'),
					and(eq(roleAssignments.scope, 'tenant'), eq(roleAssignments.scopeTenantId, tenantId))
				)
			)
		);
	return rows.map((r) => r.id);
}

async function access(p: Principal, conversationId: string) {
	if (!GUID.test(conversationId)) return null;
	const [c] = await db.select().from(conversations).where(eq(conversations.id, conversationId));
	if (!c) return null;
	const [m] = await db
		.select({ x: conversationMembers.personId })
		.from(conversationMembers)
		.where(
			and(
				eq(conversationMembers.conversationId, c.id),
				eq(conversationMembers.personId, p.personId)
			)
		);
	const viaRole =
		c.roleBox === 'moderation' &&
		c.roleTenantId !== null &&
		hasTenantRole(p, 'moderation_schwarzes_brett', c.roleTenantId);
	if (!m && !viaRole) return null;
	return { conv: c, member: Boolean(m), viaRole };
}

// ---------------------------------------------------------------------------
// Anlegen (intern, von den Vorgängen)
// ---------------------------------------------------------------------------

export async function findConversation(
	kind: 'anzeige' | 'moderation',
	refId: string,
	personId?: string
) {
	const rows = await db
		.select({ id: conversations.id, closedAt: conversations.closedAt })
		.from(conversations)
		.where(
			and(
				eq(conversations.kind, kind),
				eq(conversations.refId, refId),
				personId
					? sql`exists (select 1 from conversation_members m where m.conversation_id = ${conversations.id} and m.person_id = ${personId})`
					: undefined
			)
		)
		.orderBy(desc(conversations.createdAt))
		.limit(1);
	return rows[0] ?? null;
}

export async function startConversation(input: {
	kind: 'anzeige' | 'moderation';
	subject: string;
	refId: string;
	memberIds: string[];
	roleBox?: 'moderation';
	roleTenantId?: string;
}) {
	return db.transaction(async (tx) => {
		const [c] = await tx
			.insert(conversations)
			.values({
				kind: input.kind,
				subject: input.subject.slice(0, 200),
				refId: input.refId,
				roleBox: input.roleBox ?? null,
				roleTenantId: input.roleTenantId ?? null
			})
			.returning({ id: conversations.id });
		await tx
			.insert(conversationMembers)
			.values(
				[...new Set(input.memberIds)].map((personId) => ({ conversationId: c.id, personId }))
			);
		return c.id;
	});
}

/** Nachricht des Systems bzw. einer Rolle (z. B. Ablehnungsgrund). */
export async function postAsRole(conversationId: string, authorId: string, body: string) {
	await db
		.insert(messages)
		.values({ conversationId, authorId, asRole: true, body: body.slice(0, MESSAGE_MAX) });
	await db
		.update(conversations)
		.set({ lastMessageAt: new Date() })
		.where(eq(conversations.id, conversationId));
}

/** Gespräche zu einem Vorgang schließen (Anzeige abgelaufen, erledigt, gelöscht). */
export async function closeByRef(refId: string) {
	await db
		.update(conversations)
		.set({ closedAt: new Date() })
		.where(and(eq(conversations.refId, refId), isNull(conversations.closedAt)));
}

// ---------------------------------------------------------------------------
// Lesen
// ---------------------------------------------------------------------------

export type Box = { key: string; label: string; tenantId: string | null };

export async function boxesFor(p: Principal): Promise<Box[]> {
	const mod = await moderatedTenants(p);
	return [
		{ key: 'persoenlich', label: 'Persönlich', tenantId: null },
		...mod.map((t) => ({
			key: `moderation-${t.short.toLowerCase()}`,
			label: mod.length > 1 ? `Moderation ${t.short}` : 'Moderation Schwarzes Brett',
			tenantId: t.id
		}))
	];
}

const unreadSql = (personId: string) => sql<boolean>`coalesce((
	select ${conversations.lastMessageAt} > r.last_read_at from conversation_reads r
	where r.conversation_id = ${conversations.id} and r.person_id = ${personId}), true)
	and exists (select 1 from messages mm where mm.conversation_id = ${conversations.id}
	and (mm.author_id is null or mm.author_id <> ${personId}))`;

export async function listConversations(p: Principal, box: Box, closed: boolean) {
	const where = box.tenantId
		? and(eq(conversations.roleBox, 'moderation'), eq(conversations.roleTenantId, box.tenantId))
		: sql`exists (select 1 from conversation_members m where m.conversation_id = ${conversations.id} and m.person_id = ${p.personId})`;
	const rows = await db
		.select({
			id: conversations.id,
			kind: conversations.kind,
			subject: conversations.subject,
			closedAt: conversations.closedAt,
			lastMessageAt: conversations.lastMessageAt,
			unread: unreadSql(p.personId),
			preview: sql<
				string | null
			>`(select left(body, 140) from messages mm where mm.conversation_id = ${conversations.id} order by created_at desc limit 1)`,
			others: sql<
				string | null
			>`(select string_agg(pp.display_name, ', ') from conversation_members m join persons pp on pp.id = m.person_id where m.conversation_id = ${conversations.id} and m.person_id <> ${p.personId})`
		})
		.from(conversations)
		.where(and(where, closed ? isNotNull(conversations.closedAt) : isNull(conversations.closedAt)))
		.orderBy(desc(conversations.lastMessageAt))
		.limit(200);
	return rows.map((r) => ({
		...r,
		kindLabel: KIND_LABEL[r.kind],
		withLabel:
			r.kind === 'moderation' && !box.tenantId
				? 'mit der Moderation'
				: r.others
					? `mit ${r.others}`
					: ''
	}));
}

/** Zähler in der Kopfzeile: Gespräche mit ungelesenen Nachrichten anderer. */
export async function unreadConversations(p: Principal): Promise<number> {
	const mod = (await moderatedTenants(p)).map((t) => t.id);
	const [row] = await db
		.select({ n: sql<number>`count(*)::int` })
		.from(conversations)
		.where(
			and(
				isNull(conversations.closedAt),
				or(
					sql`exists (select 1 from conversation_members m where m.conversation_id = ${conversations.id} and m.person_id = ${p.personId})`,
					mod.length
						? and(eq(conversations.roleBox, 'moderation'), inArray(conversations.roleTenantId, mod))
						: sql`false`
				),
				unreadSql(p.personId)
			)
		);
	return row?.n ?? 0;
}

export async function getConversation(p: Principal, id: string) {
	const a = await access(p, id);
	if (!a) return null;
	const list = await db
		.select({
			id: messages.id,
			body: messages.body,
			asRole: messages.asRole,
			createdAt: messages.createdAt,
			authorId: messages.authorId,
			authorName: persons.displayName
		})
		.from(messages)
		.leftJoin(persons, eq(persons.id, messages.authorId))
		.where(eq(messages.conversationId, id))
		.orderBy(asc(messages.createdAt));
	const others = await db
		.select({ name: persons.displayName })
		.from(conversationMembers)
		.innerJoin(persons, eq(persons.id, conversationMembers.personId))
		.where(
			and(
				eq(conversationMembers.conversationId, id),
				sql`${conversationMembers.personId} <> ${p.personId}`
			)
		);
	await markRead(p.personId, id);
	const roleName = 'Moderation';
	return {
		...a.conv,
		kindLabel: KIND_LABEL[a.conv.kind],
		withLabel:
			a.conv.kind === 'moderation' && !a.viaRole
				? 'mit der Moderation'
				: others.length
					? `mit ${others.map((o) => o.name).join(', ')}`
					: '',
		canClose: a.viaRole && !a.conv.closedAt,
		viaRole: a.viaRole,
		messages: list.map((m) => ({
			id: m.id,
			body: m.body,
			createdAt: m.createdAt,
			mine: m.authorId === p.personId,
			// Anzeigende sehen „Moderation“, die Moderation sieht auch den Namen
			author: m.asRole
				? a.viaRole
					? `${roleName} (${m.authorName ?? '–'})`
					: roleName
				: (m.authorName ?? 'Gelöschtes Konto')
		}))
	};
}

async function markRead(personId: string, conversationId: string) {
	const now = new Date();
	await db
		.insert(conversationReads)
		.values({ conversationId, personId, lastReadAt: now })
		.onConflictDoUpdate({
			target: [conversationReads.conversationId, conversationReads.personId],
			set: { lastReadAt: now }
		});
}

// ---------------------------------------------------------------------------
// Schreiben
// ---------------------------------------------------------------------------

export async function sendMessage(p: Principal, id: string, body: string) {
	const a = await access(p, id);
	if (!a) throw new MessageError('Dieses Gespräch gibt es nicht.');
	if (a.conv.closedAt) throw new MessageError('Das Gespräch ist geschlossen.');
	const text = body.trim();
	if (!text) throw new MessageError('Schreib bitte eine Nachricht.');
	if (text.length > MESSAGE_MAX) throw new MessageError(`Höchstens ${MESSAGE_MAX} Zeichen.`);
	// Wer nur über das Rollen-Postfach beteiligt ist, schreibt für die Rolle
	const asRole = a.viaRole && !a.member;
	await db
		.insert(messages)
		.values({ conversationId: id, authorId: p.personId, asRole, body: text });
	await db.update(conversations).set({ lastMessageAt: new Date() }).where(eq(conversations.id, id));
	await markRead(p.personId, id);

	const members = (
		await db
			.select({ id: conversationMembers.personId })
			.from(conversationMembers)
			.where(eq(conversationMembers.conversationId, id))
	).map((m) => m.id);
	const roleSide =
		a.conv.roleBox === 'moderation' && a.conv.roleTenantId && !asRole
			? await moderatorsOf(a.conv.roleTenantId)
			: [];
	const recipients = [...new Set([...members, ...roleSide])].filter((x) => x !== p.personId);
	await notify('nachrichten', recipients, {
		title: a.conv.subject,
		detail: asRole ? 'Moderation' : null,
		link: `/nachrichten/${id}`
	});
}

/** Nur die Rolle schließt Gespräche als erledigt. */
export async function closeConversation(p: Principal, id: string) {
	const a = await access(p, id);
	if (!a?.viaRole) throw new MessageError('Das darf nur die Moderation.');
	await db.update(conversations).set({ closedAt: new Date() }).where(eq(conversations.id, id));
}

/** Löschfrist geschlossener Gespräche: 90 Tage (einstellbar, Kap. 15). */
export async function deleteClosedConversations() {
	const days = Math.max(1, Number(await getSetting('retention.conversations_days', 90)) || 90);
	await db
		.delete(conversations)
		.where(lt(conversations.closedAt, sql`now() - make_interval(days => ${days})`));
}
