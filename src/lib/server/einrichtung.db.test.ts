/**
 * Einrichtung (Hauptmandant, erster Admin, Notfallzugang) mit echter Datenbank.
 * Läuft nur mit TEST_DATABASE_URL; nutzt eine eigene Datenbank <name>_einrichtung.
 */
import { sql } from 'drizzle-orm';
import { beforeAll, describe, expect, it, vi } from 'vitest';

const url = process.env.TEST_DATABASE_URL;
const MANDANT = {
	name: 'Beispielhaus',
	kurz: 'BH',
	domains: 'oper.test, zweithaus.test',
	akzent: '#0F6E56',
	akzentDunkel: '#5DCAA5'
};

describe.skipIf(!url)('Einrichtung', () => {
	let db: typeof import('./db/index.ts').db;
	let e: typeof import('./einrichtung.ts');
	let local: typeof import('./auth/local.ts');

	beforeAll(async () => {
		const { freshDatabase, migrateWithRetry } = await import('./db/test-db.ts');
		process.env.DATABASE_URL = await freshDatabase(url as string, 'einrichtung');
		process.env.APP_DATABASE_PASSWORD ??= 'test-app-passwort';
		db = (await import('./db/index.ts')).db;
		const { runMigrations } = await import('./db/migrate.ts');
		await migrateWithRetry(() => runMigrations());
		e = await import('./einrichtung.ts');
		local = await import('./auth/local.ts');
	});

	it('schreibt ohne System-Admin beim Start einen Link ins Log', async () => {
		const log = vi.spyOn(console, 'warn').mockImplementation(() => {});
		await e.einrichtungslinkBeimStart('https://intranet.test');
		const text = String(log.mock.calls.at(-1)?.[0] ?? '');
		log.mockRestore();
		const token = /einrichtung\/([A-Za-z0-9_-]+)/.exec(text)?.[1] ?? '';
		expect(token).not.toBe('');
		expect(await e.pruefeLink(token)).toBe('erst');
		expect(await e.pruefeLink('falsch')).toBeNull();
		// Ein Neustart macht den alten Link ungültig
		const neu = await e.neuerLink('erst');
		expect(await e.pruefeLink(token)).toBeNull();
		expect(await e.pruefeLink(neu)).toBe('erst');
	});

	it('Link läuft nach 24 Stunden ab', async () => {
		const token = await e.neuerLink('erst', Date.now() - 25 * 3_600_000);
		expect(await e.pruefeLink(token)).toBeNull();
	});

	it('legt Hauptmandant und ersten Admin an, danach gilt der Link nicht mehr', async () => {
		const token = await e.neuerLink('erst');
		await expect(
			e.hauptmandantAnlegen(token, { ...MANDANT, domains: 'kaputt' }, 'x')
		).rejects.toThrow(/Domains/);
		const id = await e.hauptmandantAnlegen(token, MANDANT, '203.0.113.1');
		const [t] = await db.execute<{ main: boolean; n: number }>(
			sql`select is_main as main, (select count(*)::int from tenant_domains where tenant_id = ${id}) as n from tenants where id = ${id}`
		);
		expect(t).toEqual({ main: true, n: 2 });
		// Kein zweiter Hauptmandant
		await expect(e.hauptmandantAnlegen(token, MANDANT, 'x')).rejects.toThrow(/schon/);

		await expect(
			e.systemAdminAnlegen(token, { name: 'Kai', email: 'kai@fremd.test' }, 'x')
		).rejects.toThrow(/Domain/);
		const einladung = await e.systemAdminAnlegen(
			token,
			{ name: 'Kai Krüger', email: 'kai@oper.test' },
			'203.0.113.1'
		);
		// Einrichtungslink verbraucht, weiter mit der Einladung
		expect(await e.pruefeLink(token)).toBeNull();
		const inv = await local.findInvitation(einladung);
		expect(inv).toMatchObject({ email: 'kai@oper.test', displayName: 'Kai Krüger' });
		const [r] = await db.execute<{ role: string; scope: string; status: string; src: string }>(
			sql`select r.role, r.scope, p.status, p.auth_source as src from role_assignments r join persons p on p.id = r.person_id where p.email = 'kai@oper.test'`
		);
		expect(r).toEqual({ role: 'system_admin', scope: 'all', status: 'invited', src: 'local' });
	});

	it('abgebrochene Einrichtung lässt sich mit neuem Link fortsetzen', async () => {
		expect(await e.einrichtungNoetig()).toBe(true);
		const token = await e.neuerLink('erst');
		expect(await e.hatMandant()).toBe(true);
		await expect(
			e.systemAdminAnlegen(token, { name: 'Kai Krüger', email: 'KAI@oper.test' }, 'x')
		).resolves.toBeTruthy();
		const [{ n }] = await db.execute<{ n: number }>(
			sql`select count(*)::int as n from role_assignments where role = 'system_admin'`
		);
		expect(n).toBe(1);
	});

	it('mit aktivem Admin: kein Erst-Link mehr, Notfall-Link geht', async () => {
		await db.execute(sql`update persons set status = 'active' where email = 'kai@oper.test'`);
		expect(await e.einrichtungNoetig()).toBe(false);
		const log = vi.spyOn(console, 'warn').mockImplementation(() => {});
		await e.einrichtungslinkBeimStart('https://intranet.test');
		expect(log).not.toHaveBeenCalled();
		log.mockRestore();
		const erst = await e.neuerLink('erst');
		expect(await e.pruefeLink(erst)).toBeNull();
		await expect(
			e.systemAdminAnlegen(erst, { name: 'X Y', email: 'x@oper.test' }, 'x')
		).rejects.toThrow(/gilt nicht/);

		const notfall = await e.neuerLink('notfall');
		expect(await e.pruefeLink(notfall)).toBe('notfall');
		await expect(e.hauptmandantAnlegen(notfall, MANDANT, 'x')).rejects.toThrow(/gilt nicht/);
		await expect(
			e.systemAdminAnlegen(notfall, { name: 'Kai', email: 'kai@oper.test' }, 'x')
		).rejects.toThrow(/gibt es schon/);
		await expect(
			e.systemAdminAnlegen(notfall, { name: 'IT Notfall', email: 'it-notfall@oper.test' }, 'x')
		).resolves.toBeTruthy();
		const [{ a }] = await db.execute<{ a: number }>(
			sql`select count(*)::int as a from audit_log where action = 'setup.emergency_admin'`
		);
		expect(a).toBe(1);
	});
});
