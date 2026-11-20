/**
 * „Passwort vergessen“ mit echter Datenbank; E-Mails werden abgefangen.
 * Läuft nur mit TEST_DATABASE_URL; nutzt eine eigene Datenbank <name>_reset.
 */
import { sql } from 'drizzle-orm';
import { beforeAll, describe, expect, it, vi } from 'vitest';

const mails: { to: string; subject: string; text: string }[] = [];
vi.mock('../mail.ts', () => ({
	mailConfigured: async () => true,
	escapeHtml: (s: string) => s,
	sendMail: async (m: { to: string; subject: string; text: string }) => {
		mails.push(m);
	}
}));

const url = process.env.TEST_DATABASE_URL;
const T = '00000000-0000-0000-0000-000000000001';
const P = {
	lokal: '00000000-0000-0000-0000-0000000000c1',
	entra: '00000000-0000-0000-0000-0000000000c2',
	gesperrt: '00000000-0000-0000-0000-0000000000c3'
};
const linkToken = (text: string) => /passwort-neu\/([A-Za-z0-9_-]+)/.exec(text)?.[1] ?? '';

describe.skipIf(!url)('Passwort vergessen', () => {
	let db: typeof import('../db/index.ts').db;
	let reset: typeof import('./reset.ts');
	let verify: typeof import('./password.ts').verifyPassword;

	beforeAll(async () => {
		const { freshDatabase, migrateWithRetry } = await import('../db/test-db.ts');
		process.env.DATABASE_URL = await freshDatabase(url as string, 'reset');
		process.env.APP_DATABASE_PASSWORD ??= 'test-app-passwort';
		db = (await import('../db/index.ts')).db;
		const { runMigrations } = await import('../db/migrate.ts');
		await migrateWithRetry(() => runMigrations());
		reset = await import('./reset.ts');
		const pw = await import('./password.ts');
		verify = pw.verifyPassword;
		const altHash = await pw.hashPassword('altes passwort 123');
		await db.execute(
			sql`insert into tenants (id, name, short_name, is_main) values (${T}, 'Oper', 'HSO', true)`
		);
		await db.execute(sql`
			insert into persons (id, tenant_id, email, display_name, auth_source, entra_oid, status, disabled_at, disabled_by) values
				(${P.lokal}, ${T}, 'Lena@Oper.test', 'Lena', 'local', null, 'active', null, null),
				(${P.entra}, ${T}, 'max@oper.test', 'Max', 'entra', 'o-1', 'active', null, null),
				(${P.gesperrt}, ${T}, 'gesa@oper.test', 'Gesa', 'local', null, 'disabled', now(), 'verwaltung')`);
		await db.execute(sql`
			insert into local_credentials (person_id, password_hash, failed_attempts, last_failed_at) values
				(${P.lokal}, ${altHash}, 7, now()), (${P.gesperrt}, ${altHash}, 0, null)`);
		await db.execute(sql`
			insert into sessions (id, person_id, auth_method, expires_at) values
				('lena-1', ${P.lokal}, 'local', now() + interval '1 day')`);
	});

	it('schickt nur lokalen, aktiven Konten einen Link', async () => {
		await reset.requestPasswordReset('lena@oper.test', 'https://intranet.test', '203.0.113.1');
		await reset.requestPasswordReset('max@oper.test', 'https://intranet.test', '203.0.113.1');
		await reset.requestPasswordReset('gesa@oper.test', 'https://intranet.test', '203.0.113.1');
		await reset.requestPasswordReset('niemand@oper.test', 'https://intranet.test', '203.0.113.1');
		expect(mails.map((m) => m.to)).toEqual(['Lena@Oper.test']);
		expect(mails[0].text).toContain('https://intranet.test/anmelden/passwort-neu/');
		expect(mails[0].text).toContain('30 Minuten');
		const [{ n }] = await db.execute<{ n: number }>(
			sql`select count(*)::int as n from password_resets`
		);
		expect(n).toBe(1);
		const [{ hash }] = await db.execute<{ hash: string }>(
			sql`select token_hash as hash from password_resets`
		);
		expect(hash).not.toBe(linkToken(mails[0].text));
	});

	it('höchstens 3 Links je Stunde', async () => {
		for (let i = 0; i < 4; i++)
			await reset.requestPasswordReset('lena@oper.test', 'https://intranet.test', '203.0.113.1');
		expect(mails.filter((m) => m.to === 'Lena@Oper.test')).toHaveLength(3);
	});

	it('setzt das Passwort, beendet Sitzungen und verbraucht alle Links', async () => {
		const erster = linkToken(mails[0].text);
		const letzter = linkToken(mails[2].text);
		expect(await reset.findReset(erster)).toMatchObject({ personId: P.lokal });
		expect(await reset.completeReset(letzter, P.lokal, 'neues passwort 456', '203.0.113.1')).toBe(
			true
		);

		const [c] = await db.execute<{ password_hash: string; failed_attempts: number }>(
			sql`select password_hash, failed_attempts from local_credentials where person_id = ${P.lokal}`
		);
		expect(await verify(c.password_hash, 'neues passwort 456')).toBe(true);
		expect(c.failed_attempts).toBe(0);
		expect(await db.execute(sql`select 1 from sessions where person_id = ${P.lokal}`)).toHaveLength(
			0
		);
		// Alle Links verbraucht, auch der ältere
		expect(await reset.findReset(erster)).toBeNull();
		expect(await reset.completeReset(erster, P.lokal, 'noch eins 789 abc', '203.0.113.1')).toBe(
			false
		);
		expect(mails.at(-1)?.subject).toContain('geändert');
	});

	it('abgelaufene und fremde Links gelten nicht', async () => {
		await db.execute(
			sql`update password_resets set used_at = null, expires_at = now() - interval '1 minute'`
		);
		const t = linkToken(mails[1].text);
		expect(await reset.findReset(t)).toBeNull();
		expect(await reset.findReset('../../etc')).toBeNull();
		expect(await reset.findReset('a'.repeat(43))).toBeNull();
	});

	it('ohne Zugangsdaten wird nichts verbraucht', async () => {
		const ohne = '00000000-0000-0000-0000-0000000000c4';
		const token = 'b'.repeat(43);
		const { sha256Hex } = await import('../crypto.ts');
		await db.execute(sql`
			insert into persons (id, tenant_id, email, display_name, auth_source) values
				(${ohne}, ${T}, 'ohne@oper.test', 'Ohne', 'local')`);
		await db.execute(sql`
			insert into password_resets (token_hash, person_id, expires_at) values
				(${sha256Hex(token)}, ${ohne}, now() + interval '10 minutes')`);
		expect(await reset.findReset(token)).toBeNull();
		expect(await reset.completeReset(token, ohne, 'neues passwort 456', '203.0.113.1')).toBe(false);
		const [r] = await db.execute<{ used_at: Date | null }>(
			sql`select used_at from password_resets where person_id = ${ohne}`
		);
		expect(r.used_at).toBeNull();
	});

	it('Passwort ändern: altes Passwort nötig, Fehlversuche zählen, andere Sitzungen enden', async () => {
		const local = await import('./local.ts');
		await db.execute(
			sql`update local_credentials set failed_attempts = 0, last_failed_at = null where person_id = ${P.lokal}`
		);
		await db.execute(sql`
			insert into sessions (id, person_id, auth_method, expires_at) values
				('lena-hier', ${P.lokal}, 'local', now() + interval '1 day'),
				('lena-dort', ${P.lokal}, 'local', now() + interval '1 day')`);
		const basis = { personId: P.lokal, ip: '203.0.113.1', keepSessionId: 'lena-hier' };
		expect(
			await local.changePassword({
				...basis,
				current: 'falsch falsch falsch',
				next: 'x',
				repeat: 'x'
			})
		).toEqual({ ok: false, reason: 'wrong' });
		const [c] = await db.execute<{ n: number }>(
			sql`select failed_attempts as n from local_credentials where person_id = ${P.lokal}`
		);
		expect(c.n).toBe(1);
		expect(
			await local.changePassword({
				...basis,
				current: 'neues passwort 456',
				next: 'neues passwort 456',
				repeat: 'neues passwort 456'
			})
		).toEqual({ ok: false, reason: 'same' });
		expect(
			await local.changePassword({
				...basis,
				current: 'neues passwort 456',
				next: 'kurz',
				repeat: 'kurz'
			})
		).toEqual({ ok: false, reason: 'too_short' });
		const r = await local.changePassword({
			...basis,
			current: 'neues passwort 456',
			next: 'ganz anderes passwort 789',
			repeat: 'ganz anderes passwort 789'
		});
		expect(r).toEqual({ ok: true, beendet: 1 });
		const rest = await db.execute<{ id: string }>(
			sql`select id from sessions where person_id = ${P.lokal}`
		);
		expect(rest.map((x) => x.id)).toEqual(['lena-hier']);
		expect(mails.at(-1)?.subject).toContain('geändert');
		expect((await local.checkCurrentPassword(P.lokal, 'ganz anderes passwort 789', 'x')).ok).toBe(
			true
		);
	});
});
