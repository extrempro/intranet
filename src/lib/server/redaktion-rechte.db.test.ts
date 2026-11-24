/**
 * Rechte der Redaktion (Kap. 10): an mehrere Mandanten schreiben, eingreifen,
 * Inhalte für Einheiten ohne Pflege, FAQs „noch aktuell“, Videos zurückziehen.
 * Läuft nur mit TEST_DATABASE_URL; eigene Datenbank <name>_redaktionrechte.
 */
import { sql } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Principal } from './auth/access.ts';

const url = process.env.TEST_DATABASE_URL;
const T = {
	a: '00000000-0000-0000-0000-000000000001',
	b: '00000000-0000-0000-0000-000000000002'
};
const U = {
	/** Abteilung in A mit eigener Pflege */
	it: '00000000-0000-0000-0000-0000000000a1',
	/** Abteilung in A ohne eigene Pflege */
	lager: '00000000-0000-0000-0000-0000000000a2',
	/** Abteilung in B */
	bueroB: '00000000-0000-0000-0000-0000000000a3'
};
const P = {
	red: '00000000-0000-0000-0000-0000000000b1',
	redB: '00000000-0000-0000-0000-0000000000b2',
	leserB: '00000000-0000-0000-0000-0000000000b3',
	pflege: '00000000-0000-0000-0000-0000000000b4'
};

const entwurf = (o: object) => ({
	unitId: U.it,
	title: 'Hinweis für alle',
	bodyHtml: '<p>Text</p>',
	bodyText: 'Text',
	publishAt: new Date(Date.now() - 60_000),
	expiresAt: null,
	pinnedUntil: null,
	urgentUntil: null,
	urgentText: null,
	allTenants: false,
	tenantIds: [] as string[],
	replacePin: false,
	attachmentIds: [] as string[],
	...o
});

describe.skipIf(!url)('Rechte der Redaktion', () => {
	let db: typeof import('./db/index.ts').db;
	let access: typeof import('./auth/access.ts');
	let news: typeof import('./news.ts');
	let ein: typeof import('./redaktion-eingriffe.ts');
	let red: Principal;
	let redB: Principal;
	let leserB: Principal;

	beforeAll(async () => {
		const { freshDatabase, migrateWithRetry } = await import('./db/test-db.ts');
		process.env.DATABASE_URL = await freshDatabase(url as string, 'redaktionrechte');
		process.env.APP_DATABASE_PASSWORD ??= 'test-app-passwort';
		db = (await import('./db/index.ts')).db;
		const { runMigrations } = await import('./db/migrate.ts');
		await migrateWithRetry(() => runMigrations());
		access = await import('./auth/access.ts');
		news = await import('./news.ts');
		ein = await import('./redaktion-eingriffe.ts');
		await db.execute(sql`
			insert into tenants (id, name, short_name, is_main) values
				(${T.a}, 'Haus A', 'HA', true), (${T.b}, 'Haus B', 'HB', false)`);
		await db.execute(sql`
			insert into units (id, tenant_id, type, name, slug) values
				(${U.it}, ${T.a}, 'abteilung', 'IT', 'it'),
				(${U.lager}, ${T.a}, 'abteilung', 'Lager', 'lager'),
				(${U.bueroB}, ${T.b}, 'abteilung', 'Büro B', 'buero-b')`);
		await db.execute(sql`
			insert into persons (id, tenant_id, email, display_name, auth_source) values
				(${P.red}, ${T.a}, 'r@haus-a.example', 'Rita Redaktion', 'local'),
				(${P.redB}, ${T.b}, 'rb@haus-b.example', 'Rolf Redaktion', 'local'),
				(${P.leserB}, ${T.b}, 'l@haus-b.example', 'Lea Leserin', 'local'),
				(${P.pflege}, ${T.a}, 'p@haus-a.example', 'Paul Pflege', 'local')`);
		await db.execute(sql`
			insert into role_assignments (person_id, role, scope, scope_tenant_id, scope_unit_id) values
				(${P.red}, 'redaktion', 'all', null, null),
				(${P.redB}, 'redaktion', 'tenant', ${T.b}, null),
				(${P.pflege}, 'abteilungsverwaltung', 'unit', null, ${U.it})`);
		// Rita darf in der IT schreiben
		await db.execute(sql`
			insert into unit_members (unit_id, person_id, may_write_news) values (${U.it}, ${P.red}, true)`);
		red = await access.loadPrincipal({ id: P.red, tenantId: T.a });
		redB = await access.loadPrincipal({ id: P.redB, tenantId: T.b });
		leserB = await access.loadPrincipal({ id: P.leserB, tenantId: T.b });
	});

	it('Mandantenwahl: zentral und Redaktion für alle frei, Redaktion je Mandant begrenzt', () => {
		const ohne: Principal = { ...red, roles: [] };
		expect(news.zielMandantenVon(ohne, { isCentral: false, tenantId: T.a })).toBeNull();
		expect(news.zielMandantenVon(ohne, { isCentral: true, tenantId: T.a })).toBe('alle');
		expect(news.zielMandantenVon(red, { isCentral: false, tenantId: T.a })).toBe('alle');
		expect(news.zielMandantenVon(redB, { isCentral: false, tenantId: T.a })).toEqual([T.a, T.b]);
	});

	it('Redaktion schreibt aus einer normalen Abteilung an einen anderen Mandanten; dort sichtbar', async () => {
		const r = await news.saveNews(red, entwurf({ tenantIds: [T.b] }), '127.0.0.1');
		expect(r.ok).toBe(true);
		const liste = await news.listNews(leserB, {});
		const b = liste.find((x) => x.title === 'Hinweis für alle');
		expect(b?.sender.name).toBe('IT');
		// Seite der Abteilung ist in Haus B nicht erreichbar: kein Link
		expect(b?.sender.slug).toBeUndefined();
	});

	it('ohne Redaktion bleibt es beim eigenen Mandanten', async () => {
		const pflege = await access.loadPrincipal({ id: P.pflege, tenantId: T.a });
		const r = await news.saveNews(
			pflege,
			entwurf({ title: 'Nur für A', tenantIds: [T.b] }),
			'127.0.0.1'
		);
		expect(r.ok).toBe(true);
		const liste = await news.listNews(leserB, {});
		expect(liste.some((x) => x.title === 'Nur für A')).toBe(false);
	});

	it('Redaktion je Mandant: nicht an „alle“ und nicht an fremde Mandanten', async () => {
		// Büro B hat keine eigene Pflege: Rolf schreibt dort als Redaktion
		const zuAlle = await news.saveNews(
			redB,
			entwurf({ unitId: U.bueroB, title: 'An alle?', allTenants: true }),
			'127.0.0.1'
		);
		expect(zuAlle.ok).toBe(false);
		if (!zuAlle.ok) expect(zuAlle.errors.tenants).toMatch(/alle Mandanten/);
		// An Haus A nicht: dort ist Rolf keine Redaktion
		const zuA = await news.saveNews(
			redB,
			entwurf({ unitId: U.bueroB, title: 'An A', tenantIds: [T.a] }),
			'127.0.0.1'
		);
		expect(zuA).toMatchObject({ ok: false, errors: { tenants: /nicht schreiben/ } });
		const zuB = await news.saveNews(
			redB,
			entwurf({ unitId: U.bueroB, title: 'An B', tenantIds: [T.b] }),
			'127.0.0.1'
		);
		expect(zuB).toMatchObject({ ok: true });
	});

	it('Eingreifen: Anheften lösen, Dringend beenden, Beitrag beenden; fremde Redaktion nicht', async () => {
		const [{ id }] = await db.execute<{ id: string }>(sql`
			insert into news (unit_id, tenant_id, title, body_html, body_text, publish_at, pinned_until, urgent_until, urgent_text, all_tenants)
			values (${U.it}, ${T.a}, 'Wichtig', '<p>x</p>', 'x', now() - interval '1 hour',
				now() + interval '2 days', now() + interval '1 day', 'Achtung', false)
			returning id`);
		await db.execute(sql`insert into news_tenants (news_id, tenant_id) values (${id}, ${T.a})`);
		await expect(ein.beitragEingreifen(redB, id, 'loesen', '127.0.0.1')).rejects.toThrow(/Recht/);
		await ein.beitragEingreifen(red, id, 'loesen', '127.0.0.1');
		await ein.beitragEingreifen(red, id, 'dringend', '127.0.0.1');
		let [n] = await db.execute<{ p: Date | null; u: Date }>(
			sql`select pinned_until as p, urgent_until as u from news where id = ${id}`
		);
		expect(n.p).toBeNull();
		expect(new Date(n.u).getTime()).toBeLessThanOrEqual(Date.now());
		await ein.beitragEingreifen(red, id, 'beenden', '127.0.0.1');
		[n] = await db.execute(sql`select expires_at as u from news where id = ${id}`);
		expect(new Date(n.u).getTime()).toBeLessThanOrEqual(Date.now());
		const [{ c }] = await db.execute<{ c: number }>(
			sql`select count(*)::int as c from audit_log where action like 'news.redaktion_%' and entity_id = ${id}`
		);
		expect(c).toBe(3);
	});

	it('Einheiten ohne Pflege: Redaktion schreibt Beiträge, FAQs und Termine, sonst nicht', () => {
		const lager = { id: U.lager, tenantId: T.a, isCentral: false };
		const it = { id: U.it, tenantId: T.a, isCentral: false };
		const ohneRechte: Principal = { ...red, memberships: [] };
		expect(red.ohnePflege).toContain(U.lager);
		expect(red.ohnePflege).not.toContain(U.it);
		expect(access.canWriteNews(ohneRechte, lager)).toBe(true);
		expect(access.canWriteFaqs(ohneRechte, lager)).toBe(true);
		expect(access.canWriteEvents(ohneRechte, lager)).toBe(true);
		expect(access.canWriteMedia(ohneRechte, lager)).toBe(false);
		expect(access.canWriteNews(ohneRechte, it)).toBe(false);
		expect(access.newsUnitIds(ohneRechte).has(U.lager)).toBe(true);
		// Redaktion je Mandant B: nur Einheiten in B
		expect(redB.ohnePflege).toEqual([U.bueroB]);
	});

	it('FAQ „noch aktuell“: verschwindet aus der Arbeitsliste, „zuletzt geändert“ bleibt', async () => {
		const [{ id }] = await db.execute<{ id: string }>(sql`
			insert into faqs (unit_id, question, answer_html, answer_text, updated_at)
			values (${U.lager}, 'Wo ist der Schlüssel?', '<p>x</p>', 'x', now() - interval '400 days')
			returning id`);
		const { editorialWorklist } = await import('./redaktion.ts');
		expect((await editorialWorklist(red)).zuPruefen.alteFaqs.map((f) => f.id)).toContain(id);
		await expect(ein.faqNochAktuell(redB, id, '127.0.0.1')).rejects.toThrow(/Recht/);
		await ein.faqNochAktuell(red, id, '127.0.0.1');
		expect((await editorialWorklist(red)).zuPruefen.alteFaqs.map((f) => f.id)).not.toContain(id);
		const [f] = await db.execute<{ u: Date }>(
			sql`select updated_at as u from faqs where id = ${id}`
		);
		expect(new Date(f.u).getTime()).toBeLessThan(Date.now() - 300 * 86400_000);
	});

	it('Video zurückziehen: nur veröffentlichte, danach Entwurf', async () => {
		const [{ id }] = await db.execute<{ id: string }>(sql`
			insert into videos (unit_id, title, description, status, key_enc, bytes, duration_sec, heights, chapters, published_at)
			values (${U.it}, 'Film', '', 'veroeffentlicht', 'x', 1, 1, '{360}', '[]', now())
			returning id`);
		expect(await ein.videoEingreifbar(red, id)).toBe(true);
		expect(await ein.videoEingreifbar(redB, id)).toBe(false);
		await ein.videoZurueckziehen(red, id, '127.0.0.1');
		const [v] = await db.execute<{ s: string }>(
			sql`select status as s from videos where id = ${id}`
		);
		expect(v.s).toBe('entwurf');
		await expect(ein.videoZurueckziehen(red, id, '127.0.0.1')).rejects.toThrow(
			/nicht veröffentlicht/
		);
	});

	it('Themen pflegt nur die Redaktion für alle Mandanten (und System-Admins)', async () => {
		const { darfThemenPflegen } = await import('./themen-seite.ts');
		expect(darfThemenPflegen(red)).toBe(true);
		expect(darfThemenPflegen(redB)).toBe(false);
		expect(darfThemenPflegen(leserB)).toBe(false);
	});
});
