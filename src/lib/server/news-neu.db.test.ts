/**
 * Zähler „neue Beiträge“ (Navigation) mit echter Datenbank.
 * Läuft nur mit TEST_DATABASE_URL; eigene Datenbank <name>_newsneu.
 */
import { sql } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Principal } from './auth/access.ts';

const url = process.env.TEST_DATABASE_URL;
const T = {
	haupt: '00000000-0000-0000-0000-000000000001',
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
	const ich: Principal = { personId: P, tenantId: T.haupt, roles: [], memberships: [] };

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
				(${T.haupt}, 'Haus A', 'BH', true), (${T.b}, 'Zweithaus', 'B', false)`);
		await db.execute(sql`
			insert into units (id, tenant_id, type, name, slug, is_central) values
				(${U.it}, ${T.haupt}, 'abteilung', 'IT', 'it', true),
				(${U.kbbB}, ${T.b}, 'abteilung', 'KBB Zweithaus', 'kbb-zweithaus', false),
				(${U.hub}, ${T.haupt}, 'hub', 'Chor', 'chor', false)`);
		await db.execute(sql`
			insert into persons (id, tenant_id, email, display_name, auth_source) values
				(${P}, ${T.haupt}, 'ich@haus-a.example', 'Ich', 'local')`);
		await db.execute(sql`
			insert into news (unit_id, tenant_id, title, body_html, body_text, publish_at, all_tenants) values
				(${U.it}, ${T.haupt}, 'Alt', '<p>x</p>', 'x', now() - interval '5 days', true),
				(${U.it}, ${T.haupt}, 'Neu 1', '<p>x</p>', 'x', now() - interval '1 hour', true),
				(${U.it}, ${T.haupt}, 'Neu 2', '<p>x</p>', 'x', now() - interval '2 hours', true),
				(${U.it}, ${T.haupt}, 'Geplant', '<p>x</p>', 'x', now() + interval '1 day', true),
				(${U.hub}, ${T.haupt}, 'Aus dem Hub', '<p>x</p>', 'x', now() - interval '1 hour', true),
				(${U.kbbB}, ${T.b}, 'Nur Zweithaus', '<p>x</p>', 'x', now() - interval '1 hour', false)`);
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

	it('Liste: Vorschau mit Tabelle, Auszug ohne Tabellentext, Lesezeit', async () => {
		const { db } = await import('./db/index.ts');
		await db.execute(sql`
			insert into news (unit_id, tenant_id, title, body_html, body_text, publish_at, all_tenants) values
				(${U.it}, ${T.haupt}, 'Mit Tabelle',
				'<p>Die Zeiten:</p><table><tbody><tr><th>Tag</th><th>Zeit</th></tr><tr><td>Mo</td><td>9–12</td></tr></tbody></table><p>Ende.</p>',
				'Die Zeiten: Tag Zeit Mo 9–12 Ende.', now() - interval '3 hours', true)`);
		const liste = await news.listNews(ich, {});
		const b = liste.find((x) => x.title === 'Mit Tabelle');
		expect(b?.excerpt).toBe('Die Zeiten: Ende.');
		expect(b?.vorschau).toEqual({
			bilder: [],
			anzahlBilder: 0,
			bilderImAnhang: 0,
			tabelle: [
				['Tag', 'Zeit'],
				['Mo', '9–12']
			],
			hatTabelle: true,
			minuten: 1
		});
		expect(liste.find((x) => x.title === 'Neu 1')?.vorschau.tabelle).toBeNull();
	});

	it('lange Liste: Monate zählen alles, Schritte und Angeheftete getrennt (Kap. 6.7)', async () => {
		const { db } = await import('./db/index.ts');
		await db.execute(sql`
			insert into news (unit_id, tenant_id, title, body_html, body_text, publish_at, all_tenants, pinned_until) values
				(${U.it}, ${T.haupt}, 'Angeheftet', '<p>x</p>', 'x', now() - interval '4 hours', true, now() + interval '3 days'),
				(${U.it}, ${T.haupt}, 'Vor zwei Monaten', '<p>x</p>', 'x', now() - interval '62 days', true, null)`);
		const alle = await news.listNews(ich, { angeheftet: 'ohne', nachDatum: true, limit: 100 });
		const zahlen = await news.newsMonths(ich, { angeheftet: 'ohne' });
		expect(zahlen.gesamt).toBe(alle.length);
		expect(zahlen.monate.length).toBeGreaterThanOrEqual(2);
		expect(alle.map((x) => x.title)).not.toContain('Angeheftet');
		const nur = await news.listNews(ich, { angeheftet: 'nur' });
		expect(nur.map((x) => x.title)).toEqual(['Angeheftet']);
		const zwei = await news.listNews(ich, { angeheftet: 'ohne', nachDatum: true, limit: 2 });
		expect(zwei.map((x) => x.id)).toEqual(alle.slice(0, 2).map((x) => x.id));
		expect(alle.at(-1)?.title).toBe('Vor zwei Monaten');
	});

	it('Ansicht langer Listen wird je Person gespeichert', async () => {
		expect(await prefs.getListView(P)).toBe('ausfuehrlich');
		await prefs.setListView(P, 'kompakt');
		expect(await prefs.getListView(P)).toBe('kompakt');
	});

	it('Hubs-Übersicht: n neu seit dem letzten Besuch, Beiträge im Monat (Kap. 8.12)', async () => {
		const { db } = await import('./db/index.ts');
		const hubs = await import('./hubs.ts');
		await db.execute(sql`
			insert into hub_subscriptions (person_id, unit_id, created_at)
			values (${P}, ${U.hub}, now() - interval '2 days')`);
		let chor = (await hubs.listHubs(ich)).find((h) => h.id === U.hub);
		expect(chor?.neu).toBe(1);
		expect(chor?.proMonat).toBe(1);
		expect(chor?.abos).toBe(1);
		expect(chor?.zuletzt).toBeInstanceOf(Date);
		await hubs.markHubSeen(ich, U.hub);
		chor = (await hubs.listHubs(ich)).find((h) => h.id === U.hub);
		expect(chor?.neu).toBe(0);
	});
});
