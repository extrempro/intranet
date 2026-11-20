/**
 * Nachrichten (Kap. 9): nur Gespräche zu Vorgängen, keine freien Nachrichten.
 * Postfächer: persönlich und gemeinsam je Rolle (vorerst Moderation
 * Schwarzes Brett je Mandant). Alle mit der Rolle sehen dieselben Gespräche.
 */
import { and, asc, desc, eq, isNotNull, isNull, lt, or, sql } from 'drizzle-orm';
import { canAdministerTenant, hasTenantRole, isEditorial, type Principal } from './auth/access.ts';
import { getRetention } from './retention.ts';
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

export class MessageError extends Error {}

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const MESSAGE_MAX = 1000;

const KIND_LABEL = {
	anzeige: 'Anzeige',
	moderation: 'Moderation',
	hub_antrag: 'Hub-Antrag',
	rueckmeldung: 'Rückmeldung'
} as const;

export type RoleBox = 'moderation' | 'redaktion' | 'verwaltung';
export const ROLE_LABEL: Record<RoleBox, string> = {
	moderation: 'Moderation',
	redaktion: 'Redaktion',
	verwaltung: 'Verwaltung'
};

/** Darf die Person im Rollen-Postfach dieses Mandanten lesen und schreiben? */
export function roleAllows(p: Principal, box: RoleBox, tenantId: string): boolean {
	if (box === 'moderation') return hasTenantRole(p, 'moderation_schwarzes_brett', tenantId);
	if (box === 'redaktion') return isEditorial(p, tenantId);
	return canAdministerTenant(p, tenantId);
}

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

/** Personen, die das Rollen-Postfach dieses Mandanten bedienen (für Benachrichtigungen). */
export async function roleMembers(box: RoleBox, tenantId: string): Promise<string[]> {
	const role =
		box === 'moderation'
			? 'moderation_schwarzes_brett'
			: box === 'redaktion'
				? 'redaktion'
				: 'mandanten_admin';
	const rows = await db
		.selectDistinct({ id: roleAssignments.personId })
		.from(roleAssignments)
		.where(
			or(
				and(
					eq(roleAssignments.role, role),
					or(
						eq(roleAssignments.scope, 'all'),
						and(eq(roleAssignments.scope, 'tenant'), eq(roleAssignments.scopeTenantId, tenantId))
					)
				),
				box === 'verwaltung' ? eq(roleAssignments.role, 'system_admin') : sql`false`
			)
		);
	return rows.map((r) => r.id);
}

export async function moderatorsOf(tenantId: string): Promise<string[]> {
	return roleMembers('moderation', tenantId);
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
		c.roleBox !== null && c.roleTenantId !== null && roleAllows(p, c.roleBox, c.roleTenantId);
	if (!m && !viaRole) return null;
	return { conv: c, member: Boolean(m), viaRole };
}

// ---------------------------------------------------------------------------
// Anlegen (intern, von den Vorgängen)
// ---------------------------------------------------------------------------

export type Kind = 'anzeige' | 'moderation' | 'hub_antrag' | 'rueckmeldung';

export async function findConversation(kind: Kind, refId: string, personId?: string) {
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
	kind: Kind;
	subject: string;
	refId: string;
	memberIds: string[];
	roleBox?: RoleBox;
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

export type Box = { key: string; label: string; role: RoleBox | null; tenantId: string | null };

/** Persönliches Postfach und alle Rollen-Postfächer der Person. */
export async function boxesFor(p: Principal): Promise<Box[]> {
	const all = await db
		.select({ id: tenants.id, short: tenants.shortName })
		.from(tenants)
		.orderBy(asc(tenants.name));
	const boxes: Box[] = [{ key: 'persoenlich', label: 'Persönlich', role: null, tenantId: null }];
	for (const role of ['redaktion', 'moderation', 'verwaltung'] as const) {
		const ts = all.filter((t) => roleAllows(p, role, t.id));
		for (const t of ts)
			boxes.push({
				key: `${role}-${t.short.toLowerCase()}`,
				label:
					(role === 'moderation' ? 'Moderation Schwarzes Brett' : ROLE_LABEL[role]) +
					(ts.length > 1 ? ` ${t.short}` : ''),
				role,
				tenantId: t.id
			});
	}
	return boxes;
}

const unreadSql = (personId: string) => sql<boolean>`coalesce((
	select ${conversations.lastMessageAt} > r.last_read_at from conversation_reads r
	where r.conversation_id = ${conversations.id} and r.person_id = ${personId}), true)
	and exists (select 1 from messages mm where mm.conversation_id = ${conversations.id}
	and (mm.author_id is null or mm.author_id <> ${personId}))`;

export async function listConversations(p: Principal, box: Box, closed: boolean) {
	const where =
		box.role && box.tenantId
			? and(eq(conversations.roleBox, box.role), eq(conversations.roleTenantId, box.tenantId))
			: sql`exists (select 1 from conversation_members m where m.conversation_id = ${conversations.id} and m.person_id = ${p.personId})`;
	const rows = await db
		.select({
			id: conversations.id,
			kind: conversations.kind,
			subject: conversations.subject,
			closedAt: conversations.closedAt,
			lastMessageAt: conversations.lastMessageAt,
			roleBox: conversations.roleBox,
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
	const roleBoxes = (await boxesFor(p)).filter((b) => b.role && b.tenantId);
	const [row] = await db
		.select({ n: sql<number>`count(*)::int` })
		.from(conversations)
		.where(
			and(
				isNull(conversations.closedAt),
				or(
					sql`exists (select 1 from conversation_members m where m.conversation_id = ${conversations.id} and m.person_id = ${p.personId})`,
					...roleBoxes.map((b) =>
						and(eq(conversations.roleBox, b.role!), eq(conversations.roleTenantId, b.tenantId!))
					)
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
	const roleName = a.conv.roleBox ? ROLE_LABEL[a.conv.roleBox] : '';
	return {
		...a.conv,
		kindLabel: KIND_LABEL[a.conv.kind],
		withLabel:
			a.conv.roleBox && !a.member
				? others.length
					? `mit ${others.map((o) => o.name).join(', ')}`
					: ''
				: a.conv.roleBox
					? `mit der ${roleName}`
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
		a.conv.roleBox && a.conv.roleTenantId && !asRole
			? await roleMembers(a.conv.roleBox, a.conv.roleTenantId)
			: [];
	const recipients = [...new Set([...members, ...roleSide])].filter((x) => x !== p.personId);
	await notify('nachrichten', recipients, {
		title: a.conv.subject,
		detail: asRole && a.conv.roleBox ? ROLE_LABEL[a.conv.roleBox] : null,
		link: `/nachrichten/${id}`
	});
}

/** Nur die Rolle schließt Gespräche als erledigt. */
export async function closeConversation(p: Principal, id: string) {
	const a = await access(p, id);
	if (!a?.viaRole) throw new MessageError('Das darf nur die zuständige Rolle.');
	await db.update(conversations).set({ closedAt: new Date() }).where(eq(conversations.id, id));
}

/** Löschfrist geschlossener Gespräche: 90 Tage (einstellbar, Kap. 15). */
export async function deleteClosedConversations() {
	const days = await getRetention('conversations_days');
	await db
		.delete(conversations)
		.where(lt(conversations.closedAt, sql`now() - make_interval(days => ${days})`));
}
