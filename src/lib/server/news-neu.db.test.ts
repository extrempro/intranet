/**
 * Zähler „neue Beiträge“ (Navigation) mit echter Datenbank.
 * Läuft nur mit TEST_DATABASE_URL; eigene Datenbank <name>_newsneu.
 */
import { sql } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Principal } from './auth/access.ts';

const url = process.env.TEST_DATABASE_URL;
const T = {
	hso: '00000000-0000-0000-0000-000000000001',
	b: '00000000-0000-0000-0000-000000000002'
};
const U = {
	it: '00000000-0000-0000-0000-0000000000a1',
	kbbB: '00000000-0000-0000-0000-0000000000a2',
	hub: '00000000-0000-0000-0000-0000000000a3'
};
const P = '00000000-0000-0000-0000-0000000000b1';

describe.skipIf(!url)('Zähler neue Beiträge', () => {
	let news: typeof import('./news.ts');
	let prefs: typeof import('./preferences.ts');
	const ich: Principal = { personId: P, tenantId: T.hso, roles: [], memberships: [] };

	beforeAll(async () => {
		const { freshDatabase, migrateWithRetry } = await import('./db/test-db.ts');
		process.env.DATABASE_URL = await freshDatabase(url as string, 'newsneu');
		process.env.APP_DATABASE_PASSWORD ??= 'test-app-passwort';
		const { db } = await import('./db/index.ts');
		const { runMigrations } = await import('./db/migrate.ts');
		await migrateWithRetry(() => runMigrations());
		news = await import('./news.ts');
		prefs = await import('./preferences.ts');
		await db.execute(sql`
			insert into tenants (id, name, short_name, is_main) values
				(${T.hso}, 'Oper', 'HSO', true), (${T.b}, 'Ballett', 'B', false)`);
		await db.execute(sql`
			insert into units (id, tenant_id, type, name, slug, is_central) values
				(${U.it}, ${T.hso}, 'abteilung', 'IT', 'it', true),
				(${U.kbbB}, ${T.b}, 'abteilung', 'KBB Ballett', 'kbb-ballett', false),
				(${U.hub}, ${T.hso}, 'hub', 'Chor', 'chor', false)`);
		await db.execute(sql`
			insert into persons (id, tenant_id, email, display_name, auth_source) values
				(${P}, ${T.hso}, 'ich@oper.de', 'Ich', 'local')`);
		await db.execute(sql`
			insert into news (unit_id, tenant_id, title, body_html, body_text, publish_at, all_tenants) values
				(${U.it}, ${T.hso}, 'Alt', '<p>x</p>', 'x', now() - interval '5 days', true),
				(${U.it}, ${T.hso}, 'Neu 1', '<p>x</p>', 'x', now() - interval '1 hour', true),
				(${U.it}, ${T.hso}, 'Neu 2', '<p>x</p>', 'x', now() - interval '2 hours', true),
				(${U.it}, ${T.hso}, 'Geplant', '<p>x</p>', 'x', now() + interval '1 day', true),
				(${U.hub}, ${T.hso}, 'Aus dem Hub', '<p>x</p>', 'x', now() - interval '1 hour', true),
				(${U.kbbB}, ${T.b}, 'Nur Ballett', '<p>x</p>', 'x', now() - interval '1 hour', false)`);
	});

	it('zählt nur sichtbare, veröffentlichte Neuigkeiten seit dem letzten Besuch', async () => {
		const seit = new Date(Date.now() - 2 * 24 * 3600 * 1000);
		expect(await news.countNewNews(ich, seit)).toBe(2);
	});

	it('zählt nach dem Besuch nichts mehr', async () => {
		await prefs.markNewsSeen(P);
		const gesehen = await prefs.getNewsSeen(P);
		expect(gesehen).toBeInstanceOf(Date);
		expect(await news.countNewNews(ich, gesehen!)).toBe(0);
	});
});
