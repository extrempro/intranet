/**
 * Eigene Sitzungen in PostgreSQL (Kap. 4.4, 16).
 * Im Cookie steht ein zufälliges Token, in der Datenbank nur sein SHA-256.
 * Abmelden nach Inaktivität: Einstellung „session.idle“ (30m / 8h / 7d,
 * Standard 8h), gilt für Entra und lokal. Höchstdauer 30 Tage.
 */
import { createHash, randomBytes } from 'node:crypto';
import type { Cookies } from '@sveltejs/kit';
import { and, desc, eq, lt, ne, or, sql } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { persons, sessions } from '../db/schema.ts';
import { ipPrefix } from '../net.ts';
import { getSetting } from '../settings.ts';

export const SESSION_COOKIE = '__Host-intranet-sitzung';
/**
 * Sitzung in der Teams-App: Das Intranet läuft dort eingebettet, Cookies
 * gelten als Drittanbieter-Cookies. Darum SameSite=None und „Partitioned“:
 * Das Cookie gilt nur unter Teams (Partition) und nie für andere Seiten.
 */
export const TEAMS_SESSION_COOKIE = '__Host-intranet-teams';

export const IDLE_OPTIONS = {
	'30m': 30 * 60 * 1000,
	'8h': 8 * 60 * 60 * 1000,
	'7d': 7 * 24 * 60 * 60 * 1000
} as const;
export type IdleOption = keyof typeof IDLE_OPTIONS;
export const DEFAULT_IDLE: IdleOption = '8h';
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

let idleCache: { value: number; at: number } | null = null;
/** Inaktivitätsgrenze in ms, eine Minute zwischengespeichert. */
export async function idleTimeoutMs(): Promise<number> {
	if (idleCache && Date.now() - idleCache.at < 60_000) return idleCache.value;
	const key = await getSetting<string>('session.idle', DEFAULT_IDLE);
	const value = IDLE_OPTIONS[key as IdleOption] ?? IDLE_OPTIONS[DEFAULT_IDLE];
	idleCache = { value, at: Date.now() };
	return value;
}

export function clearIdleCache() {
	idleCache = null;
}
/** lastActiveAt nur schreiben, wenn älter als das – spart Schreibzugriffe. */
const TOUCH_INTERVAL_MS = 60 * 1000;

export function hashToken(token: string): string {
	return createHash('sha256').update(token).digest('hex');
}

export interface SessionPerson {
	id: string;
	tenantId: string;
	email: string;
	displayName: string;
}

export interface ValidSession {
	id: string;
	authMethod: 'entra' | 'local';
	/** Letzte erneute Anmeldung (Bestätigung vor kritischen Aktionen) */
	confirmedAt: Date | null;
	person: SessionPerson;
}

export async function createSession(
	personId: string,
	authMethod: 'entra' | 'local',
	meta: { userAgent?: string | null; ip?: string | null }
): Promise<{ token: string; expiresAt: Date }> {
	const token = randomBytes(32).toString('base64url');
	const expiresAt = new Date(Date.now() + MAX_AGE_MS);
	await db.insert(sessions).values({
		id: hashToken(token),
		personId,
		authMethod,
		expiresAt,
		userAgent: meta.userAgent?.slice(0, 300) ?? null,
		ipPrefix: ipPrefix(meta.ip)
	});
	return { token, expiresAt };
}

/** Prüft das Token; abgelaufene oder inaktive Sitzungen werden sofort gelöscht. */
export async function validateSession(token: string): Promise<ValidSession | null> {
	const id = hashToken(token);
	const [row] = await db
		.select({
			id: sessions.id,
			authMethod: sessions.authMethod,
			confirmedAt: sessions.confirmedAt,
			lastActiveAt: sessions.lastActiveAt,
			expiresAt: sessions.expiresAt,
			person: {
				id: persons.id,
				tenantId: persons.tenantId,
				email: persons.email,
				displayName: persons.displayName,
				status: persons.status
			}
		})
		.from(sessions)
		.innerJoin(persons, eq(persons.id, sessions.personId))
		.where(eq(sessions.id, id));
	if (!row) return null;

	const now = Date.now();
	const idle = now - row.lastActiveAt.getTime() > (await idleTimeoutMs());
	if (idle || row.expiresAt.getTime() <= now || row.person.status !== 'active') {
		await db.delete(sessions).where(eq(sessions.id, id));
		return null;
	}

	if (now - row.lastActiveAt.getTime() > TOUCH_INTERVAL_MS) {
		await db
			.update(sessions)
			.set({ lastActiveAt: new Date(now) })
			.where(eq(sessions.id, id));
	}

	const { id: personId, tenantId, email, displayName } = row.person;
	return {
		id: row.id,
		authMethod: row.authMethod,
		confirmedAt: row.confirmedAt,
		person: { id: personId, tenantId, email, displayName }
	};
}

export async function invalidateSession(token: string): Promise<void> {
	await db.delete(sessions).where(eq(sessions.id, hashToken(token)));
}

export function setSessionCookie(cookies: Cookies, token: string, expiresAt: Date) {
	cookies.set(SESSION_COOKIE, token, {
		path: '/',
		httpOnly: true,
		secure: true,
		sameSite: 'lax',
		expires: expiresAt
	});
}

export function deleteSessionCookie(cookies: Cookies) {
	cookies.delete(SESSION_COOKIE, { path: '/', httpOnly: true, secure: true, sameSite: 'lax' });
}

export function setTeamsSessionCookie(cookies: Cookies, token: string, expiresAt: Date) {
	cookies.set(TEAMS_SESSION_COOKIE, token, {
		path: '/',
		httpOnly: true,
		secure: true,
		sameSite: 'none',
		partitioned: true,
		expires: expiresAt
	});
}

export function deleteTeamsSessionCookie(cookies: Cookies) {
	cookies.delete(TEAMS_SESSION_COOKIE, {
		path: '/',
		httpOnly: true,
		secure: true,
		sameSite: 'none',
		partitioned: true
	});
}

export interface SessionInfo {
	id: string;
	authMethod: 'entra' | 'local';
	createdAt: Date;
	lastActiveAt: Date;
	userAgent: string | null;
	ipPrefix: string | null;
}

/** Eigene Sitzungen für „Konto → Sicherheit“ (Kap. 4.4). */
export async function listSessions(personId: string): Promise<SessionInfo[]> {
	return db
		.select({
			id: sessions.id,
			authMethod: sessions.authMethod,
			createdAt: sessions.createdAt,
			lastActiveAt: sessions.lastActiveAt,
			userAgent: sessions.userAgent,
			ipPrefix: sessions.ipPrefix
		})
		.from(sessions)
		.where(eq(sessions.personId, personId))
		.orderBy(desc(sessions.lastActiveAt));
}

/** Beendet eine eigene Sitzung; die ID ist der Hash, nie das Token. */
export async function endOwnSession(personId: string, sessionId: string): Promise<boolean> {
	const rows = await db
		.delete(sessions)
		.where(and(eq(sessions.id, sessionId), eq(sessions.personId, personId)))
		.returning({ id: sessions.id });
	return rows.length === 1;
}

export async function endOtherSessions(personId: string, currentId: string): Promise<number> {
	const rows = await db
		.delete(sessions)
		.where(and(eq(sessions.personId, personId), ne(sessions.id, currentId)))
		.returning({ id: sessions.id });
	return rows.length;
}

/** Alle Sitzungen einer Person beenden (z. B. beim Sperren). */
export async function endAllSessions(personId: string): Promise<void> {
	await db.delete(sessions).where(eq(sessions.personId, personId));
}

/** Abgelaufene und inaktive Sitzungen löschen (Löschfrist „sofort nach Ende“). */
export async function deleteExpiredSessions(): Promise<number> {
	const idle = await idleTimeoutMs();
	const rows = await db
		.delete(sessions)
		.where(
			or(
				lt(sessions.expiresAt, new Date()),
				lt(sessions.lastActiveAt, sql`now() - ${`${idle} milliseconds`}::interval`)
			)
		)
		.returning({ id: sessions.id });
	return rows.length;
}
