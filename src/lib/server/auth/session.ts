/**
 * Eigene Sitzungen in PostgreSQL (Kap. 4.4, 16).
 * Im Cookie steht ein zufälliges Token, in der Datenbank nur sein SHA-256.
 * Inaktivität und Höchstdauer werden in Schritt 4 einstellbar.
 */
import { createHash, randomBytes } from 'node:crypto';
import type { Cookies } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { persons, sessions } from '../db/schema.ts';
import { ipPrefix } from '../net.ts';

export const SESSION_COOKIE = '__Host-intranet-sitzung';

/** Standard bis zur Einstellbarkeit: 8 Stunden Inaktivität, höchstens 30 Tage. */
const IDLE_TIMEOUT_MS = 8 * 60 * 60 * 1000;
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
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
	const idle = now - row.lastActiveAt.getTime() > IDLE_TIMEOUT_MS;
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
