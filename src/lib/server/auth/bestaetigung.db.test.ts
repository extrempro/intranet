/**
 * Erneute Anmeldung vor kritischen Verwaltungsaktionen, mit echter Datenbank.
 * Läuft nur mit TEST_DATABASE_URL; nutzt eine eigene Datenbank <name>_reauth.
 */
import { sql } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import { sha256Hex } from '../crypto.ts';

const url = process.env.TEST_DATABASE_URL;
const T = '00000000-0000-0000-0000-000000000001';
const P = {
	lokal: '00000000-0000-0000-0000-0000000000d1',
	entra: '00000000-0000-0000-0000-0000000000d2'
};
const CODE = 'ABCD-EFGH-JKLM';

function locals(
	personId: string,
	sessionId: string,
	authMethod: 'local' | 'entra',
	confirmedAt: Date | null = null,
	teams = false
): App.Locals {
	return {
		person: { id: personId, tenantId: T, email: 'x@haus-a.test', displayName: 'X' },
		session: { id: sessionId, authMethod, confirmedAt },
		principal: null,
		theme: 'auto',
		teams
	};
}

describe.skipIf(!url)('Erneute Anmeldung', () => {
	let db: typeof import('../db/index.ts').db;
	let b: typeof import('./bestaetigung.ts');

	async function bestaetigtAm(id: string): Promise<string | null> {
		const [r] = await db.execute<{ at: string | null }>(
			sql`select confirmed_at as at from sessions where id = ${id}`
		);
		return r.at;
	}

	beforeAll(async () => {
		const { freshDatabase, migrateWithRetry } = await import('../db/test-db.ts');
		process.env.DATABASE_URL = await freshDatabase(url as string, 'reauth');
		process.env.APP_DATABASE_PASSWORD ??= 'test-app-passwort';
		db = (await import('../db/index.ts')).db;
		const { runMigrations } = await import('../db/migrate.ts');
		await migrateWithRetry(() => runMigrations());
		b = await import('./bestaetigung.ts');
		await db.execute(
			sql`insert into tenants (id, name, short_name, is_main) values (${T}, 'Haus A', 'BH', true)`
		);
		await db.execute(sql`
			insert into persons (id, tenant_id, email, display_name, auth_source, entra_oid) values
				(${P.lokal}, ${T}, 'lena@haus-a.test', 'Lena', 'local', null),
				(${P.entra}, ${T}, 'max@haus-a.test', 'Max', 'entra', 'oid-max')`);
		await db.execute(
			sql`insert into local_credentials (person_id, password_hash) values (${P.lokal}, 'x')`
		);
		await db.execute(sql`
			insert into recovery_codes (person_id, code_hash) values
				(${P.lokal}, ${sha256Hex(CODE.replace(/-/g, ''))})`);
		await db.execute(sql`
			insert into sessions (id, person_id, auth_method, expires_at) values
				('lena', ${P.lokal}, 'local', now() + interval '1 day'),
				('max', ${P.entra}, 'entra', now() + interval '1 day')`);
	});

	it('gilt 10 Minuten', () => {
		const jetzt = Date.now();
		const frisch = locals(P.lokal, 'lena', 'local', new Date(jetzt - 9 * 60_000));
		const alt = locals(P.lokal, 'lena', 'local', new Date(jetzt - 11 * 60_000));
		expect(b.bestaetigtBis(frisch, jetzt)).not.toBeNull();
		expect(b.bestaetigtBis(alt, jetzt)).toBeNull();
		expect(b.bestaetigungFehlt(frisch)).toBeNull();
		expect(b.bestaetigungFehlt(alt)).toMatchObject({ status: 403, data: { bestaetigung: true } });
		expect(b.bestaetigungFehlt(locals(P.lokal, 'lena', 'local'))).not.toBeNull();
	});

	it('zeigt die passenden Wege', async () => {
		expect(await b.bestaetigungsWege(locals(P.lokal, 'lena', 'local'))).toEqual({
			art: 'lokal',
			totp: false,
			passkey: false,
			teams: false
		});
		expect(await b.bestaetigungsWege(locals(P.entra, 'max', 'entra', null, true))).toEqual({
			art: 'entra',
			teams: true
		});
	});

	it('lokal: falscher Code zählt als Fehlversuch, richtiger Code bestätigt einmalig', async () => {
		const l = locals(P.lokal, 'lena', 'local');
		expect(await b.mitCodeBestaetigen(l, 'ZZZZ-ZZZZ-ZZZZ', '203.0.113.1')).toEqual({
			ok: false,
			grund: 'falsch'
		});
		const [{ n }] = await db.execute<{ n: number }>(
			sql`select failed_attempts as n from local_credentials where person_id = ${P.lokal}`
		);
		expect(n).toBe(1);
		// Wartezeit nach dem Fehlversuch abwarten lassen
		await db.execute(
			sql`update local_credentials set last_failed_at = now() - interval '1 hour' where person_id = ${P.lokal}`
		);
		const r = await b.mitCodeBestaetigen(l, CODE.toLowerCase(), '203.0.113.1');
		expect(r.ok).toBe(true);
		expect(await bestaetigtAm('lena')).not.toBeNull();
		// Wiederherstellungscode ist verbraucht
		expect((await b.mitCodeBestaetigen(l, CODE, '203.0.113.1')).ok).toBe(false);
		const [{ a }] = await db.execute<{ a: number }>(
			sql`select count(*)::int as a from audit_log where action = 'reauth.success' and actor_id = ${P.lokal}`
		);
		expect(a).toBe(1);
	});

	it('Microsoft-Konto kann nicht mit Code bestätigen, Teams-Sitzung gar nicht lokal', async () => {
		expect(await b.mitCodeBestaetigen(locals(P.entra, 'max', 'entra'), CODE, 'x')).toEqual({
			ok: false,
			grund: 'nicht_moeglich'
		});
		expect(await b.passkeyOptionen(locals(P.entra, 'max', 'entra'), 'https://i.test')).toBeNull();
	});

	it('Microsoft: nur dieselbe Person bestätigt die eigene Sitzung', async () => {
		expect(await b.mitEntraBestaetigen('max', 'oid-fremd', '203.0.113.1')).toBe(false);
		expect(await bestaetigtAm('max')).toBeNull();
		expect(await b.mitEntraBestaetigen('lena', 'oid-max', '203.0.113.1')).toBe(false);
		expect(await b.mitEntraBestaetigen('max', 'oid-max', '203.0.113.1')).toBe(true);
		expect(await bestaetigtAm('max')).not.toBeNull();
	});
});
