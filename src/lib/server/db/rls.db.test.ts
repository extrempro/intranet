/**
 * Prüft die Mandantentrennung in PostgreSQL (Row-Level Security) mit echter
 * Datenbank. Läuft nur, wenn TEST_DATABASE_URL gesetzt ist (CI: Postgres-Dienst).
 * Achtung: Die Datenbank wird dabei geleert.
 */
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const url = process.env.TEST_DATABASE_URL;
const T = {
	hso: '00000000-0000-0000-0000-000000000001',
	b: '00000000-0000-0000-0000-000000000002'
};
const U = {
	it: '00000000-0000-0000-0000-0000000000a1',
	kbbHso: '00000000-0000-0000-0000-0000000000a2',
	kbbB: '00000000-0000-0000-0000-0000000000a3'
};
const P = {
	itPerson: '00000000-0000-0000-0000-0000000000b1',
	b: '00000000-0000-0000-0000-0000000000b2',
	hso: '00000000-0000-0000-0000-0000000000b3'
};

const N = {
	oper: '00000000-0000-0000-0000-0000000000c1',
	zentralB: '00000000-0000-0000-0000-0000000000c2',
	zentralAlle: '00000000-0000-0000-0000-0000000000c3'
};

describe.skipIf(!url)('Row-Level Security', () => {
	let mod: typeof import('./index.ts');

	beforeAll(async () => {
		process.env.DATABASE_URL = url;
		process.env.APP_DATABASE_PASSWORD ??= 'test-app-passwort';
		mod = await import('./index.ts');
		const { db } = mod;
		await db.execute(sql`drop schema if exists public cascade`);
		await db.execute(sql`drop schema if exists drizzle cascade`);
		await db.execute(sql`create schema public`);
		const { runMigrations } = await import('./migrate.ts');
		await runMigrations();

		await db.execute(sql`
			insert into tenants (id, name, short_name, is_main) values
				(${T.hso}, 'Staatsoper', 'HSO', true), (${T.b}, 'Ballett', 'B', false)`);
		await db.execute(sql`
			insert into units (id, tenant_id, type, name, slug, is_central) values
				(${U.it}, ${T.hso}, 'abteilung', 'IT', 'it', true),
				(${U.kbbHso}, ${T.hso}, 'abteilung', 'KBB Oper', 'kbb-oper', false),
				(${U.kbbB}, ${T.b}, 'abteilung', 'KBB Ballett', 'kbb-ballett', false)`);
		await db.execute(sql`
			insert into persons (id, tenant_id, email, display_name, auth_source) values
				(${P.itPerson}, ${T.hso}, 'it@oper.de', 'IT-Person', 'local'),
				(${P.b}, ${T.b}, 'b@ballett.de', 'Ballett-Person', 'local'),
				(${P.hso}, ${T.hso}, 'oper@oper.de', 'Opern-Person', 'local')`);
		await db.execute(sql`
			insert into unit_members (unit_id, person_id) values
				(${U.it}, ${P.itPerson}), (${U.kbbHso}, ${P.hso}), (${U.kbbB}, ${P.b})`);
		await db.execute(
			sql`insert into local_credentials (person_id, password_hash) values (${P.b}, 'geheim')`
		);
		await db.execute(sql`
			insert into news (id, unit_id, tenant_id, title, body_html, body_text, publish_at, all_tenants) values
				(${N.oper}, ${U.kbbHso}, ${T.hso}, 'Nur Oper', '<p>x</p>', 'x', now(), false),
				(${N.zentralB}, ${U.it}, ${T.hso}, 'Zentral für B', '<p>x</p>', 'x', now(), false),
				(${N.zentralAlle}, ${U.it}, ${T.hso}, 'Zentral für alle', '<p>x</p>', 'x', now(), true)`);
		await db.execute(sql`
			insert into news_tenants (news_id, tenant_id) values
				(${N.oper}, ${T.hso}), (${N.zentralB}, ${T.b})`);
		await db.execute(sql`
			insert into urgent_dismissals (news_id, person_id) values (${N.zentralAlle}, ${P.itPerson})`);
		await db.execute(sql`
			insert into faqs (unit_id, question, answer_html, answer_text) values
				(${U.it}, 'Zentrale Frage?', '<p>a</p>', 'a'),
				(${U.kbbHso}, 'Frage der Oper?', '<p>a</p>', 'a'),
				(${U.kbbB}, 'Frage des Balletts?', '<p>a</p>', 'a')`);
	});

	afterAll(async () => {
		// Verbindungen schließen, damit vitest endet
		await mod?.closeDb();
	});

	const asB = { personId: P.b, tenantId: T.b };

	it('zeigt Einheiten des eigenen Mandanten und zentrale', async () => {
		const rows = await mod.scoped(asB, (tx) =>
			tx.execute<{ slug: string }>(sql`select slug from units order by slug`)
		);
		expect(rows.map((r) => r.slug)).toEqual(['it', 'kbb-ballett']);
	});

	it('zeigt Personen des eigenen Mandanten und aus zentralen Einheiten', async () => {
		const rows = await mod.scoped(asB, (tx) =>
			tx.execute<{ id: string }>(sql`select id from persons order by id`)
		);
		expect(rows.map((r) => r.id)).toEqual([P.itPerson, P.b]);
	});

	it('zeigt nur Team-Einträge sichtbarer Einheiten', async () => {
		const rows = await mod.scoped(asB, (tx) =>
			tx.execute<{ unit_id: string }>(sql`select unit_id from unit_members order by unit_id`)
		);
		expect(rows.map((r) => r.unit_id)).toEqual([U.it, U.kbbB]);
	});

	it('verhindert Änderungen an fremden und zentralen Einheiten', async () => {
		const n = await mod.scoped(asB, (tx) =>
			tx.execute(sql`update units set name = 'X' where id in (${U.kbbHso}, ${U.it})`)
		);
		expect(n.count).toBe(0);
		await expect(
			mod.scoped(asB, (tx) =>
				tx.execute(
					sql`insert into units (tenant_id, type, name, slug) values (${T.hso}, 'abteilung', 'Fremd', 'fremd')`
				)
			)
		).rejects.toThrow();
	});

	it('erlaubt eigene Kontaktdaten, aber keine fremden und keine E-Mail', async () => {
		const own = await mod.scoped(asB, (tx) =>
			tx.execute(sql`update persons set phone = '123' where id = ${P.b}`)
		);
		expect(own.count).toBe(1);
		const other = await mod.scoped(asB, (tx) =>
			tx.execute(sql`update persons set phone = '123' where id = ${P.itPerson}`)
		);
		expect(other.count).toBe(0);
		await expect(
			mod.scoped(asB, (tx) =>
				tx.execute(sql`update persons set email = 'x@y.de' where id = ${P.b}`)
			)
		).rejects.toMatchObject({ cause: { code: '42501' } });
	});

	it('zeigt FAQs nur von sichtbaren Einheiten', async () => {
		const rows = await mod.scoped(asB, (tx) =>
			tx.execute<{ question: string }>(sql`select question from faqs order by question`)
		);
		expect(rows.map((r) => r.question)).toEqual(['Frage des Balletts?', 'Zentrale Frage?']);
		await expect(mod.scoped(asB, (tx) => tx.execute(sql`delete from faqs`))).rejects.toMatchObject({
			cause: { code: '42501' }
		});
	});

	it('sperrt Anmeldedaten, Sitzungen und Rollen für die App-Rolle', async () => {
		for (const table of [
			'local_credentials',
			'sessions',
			'role_assignments',
			'audit_log',
			'location_operators',
			'menus',
			'events',
			'calendar_feeds',
			'notifications'
		]) {
			await expect(
				mod.scoped(asB, (tx) => tx.execute(sql.raw(`select * from ${table}`)))
			).rejects.toMatchObject({ cause: { code: '42501' } });
		}
	});

	it('zeigt nur Neuigkeiten für den eigenen Mandanten', async () => {
		const rows = await mod.scoped(asB, (tx) =>
			tx.execute<{ title: string }>(sql`select title from news order by title`)
		);
		expect(rows.map((r) => r.title).sort()).toEqual(['Zentral für B', 'Zentral für alle'].sort());
	});

	it('zeigt keine fremden Zielzuordnungen und keine fremden zugeklappten Banner', async () => {
		const targets = await mod.scoped(asB, (tx) => tx.execute(sql`select * from news_tenants`));
		expect(targets.length).toBe(1);
		const dismissed = await mod.scoped(asB, (tx) =>
			tx.execute(sql`select * from urgent_dismissals`)
		);
		expect(dismissed.length).toBe(0);
	});

	it('verbietet Schreiben in Neuigkeiten und Reaktionen', async () => {
		await expect(
			mod.scoped(asB, (tx) => tx.execute(sql`update news set title = 'x'`))
		).rejects.toMatchObject({ cause: { code: '42501' } });
		await expect(
			mod.scoped(asB, (tx) => tx.execute(sql`select * from news_reactions`))
		).rejects.toMatchObject({ cause: { code: '42501' } });
	});

	it('zeigt ohne gesetzten Mandanten nichts', async () => {
		const rows = await mod.scoped({ personId: P.b, tenantId: '' }, (tx) =>
			tx.execute(sql`select id from units where not is_central`)
		);
		expect(rows.length).toBe(0);
	});
});
