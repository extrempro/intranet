/**
 * Hub-Inhalte: Wer pflegt was, wer sieht Dateien, das Hub-Team bleibt nie leer.
 * Läuft nur mit TEST_DATABASE_URL; eigene Datenbank <name>_hubinhalte.
 */
import { sql } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Principal } from './auth/access.ts';

const url = process.env.TEST_DATABASE_URL;
const T1 = '00000000-0000-0000-0000-000000000001';
const T2 = '00000000-0000-0000-0000-000000000002';
const ZENTRAL = '00000000-0000-0000-0000-0000000000a1';
const EIGEN = '00000000-0000-0000-0000-0000000000a2';
const TEAM = '00000000-0000-0000-0000-0000000000b1';
const FREMD = '00000000-0000-0000-0000-0000000000b2';
const DOKS = '00000000-0000-0000-0000-0000000000b3';
const DATEI = '00000000-0000-4000-8000-00000000f001';

const mitglied = (unitId: string, docs = false) => ({
	unitId,
	isPrimary: false,
	mayWriteNews: false,
	mayWriteFaqs: false,
	mayWriteEvents: false,
	mayWriteBehindScenes: false,
	mayWriteDocuments: docs
});

describe.skipIf(!url)('Hub-Inhalte', () => {
	let db: typeof import('./db/index.ts').db;
	let hi: typeof import('./hub-inhalte.ts');
	let units: typeof import('./units.ts');
	const team: Principal = {
		personId: TEAM,
		tenantId: T1,
		roles: [
			{ role: 'hub_team', scope: 'unit', scopeTenantId: null, scopeUnitId: ZENTRAL },
			{ role: 'hub_team', scope: 'unit', scopeTenantId: null, scopeUnitId: EIGEN }
		],
		memberships: [mitglied(ZENTRAL), mitglied(EIGEN)]
	};
	const fremd: Principal = { personId: FREMD, tenantId: T2, roles: [], memberships: [] };
	const doks: Principal = {
		personId: DOKS,
		tenantId: T1,
		roles: [],
		memberships: [mitglied(ZENTRAL, true)]
	};

	beforeAll(async () => {
		const { freshDatabase, migrateWithRetry } = await import('./db/test-db.ts');
		process.env.DATABASE_URL = await freshDatabase(url as string, 'hubinhalte');
		process.env.APP_DATABASE_PASSWORD ??= 'test-app-passwort';
		db = (await import('./db/index.ts')).db;
		const { runMigrations } = await import('./db/migrate.ts');
		await migrateWithRetry(() => runMigrations());
		hi = await import('./hub-inhalte.ts');
		units = await import('./units.ts');
		await db.execute(sql`insert into tenants (id, name, short_name, is_main) values
			(${T1}, 'Oper', 'HSO', true), (${T2}, 'Ballett', 'HB', false)`);
		await db.execute(sql`insert into units (id, tenant_id, type, name, slug, is_central) values
			(${ZENTRAL}, ${T1}, 'hub', 'Chor', 'chor', true), (${EIGEN}, ${T1}, 'hub', 'Laufen', 'laufen', false)`);
		await db.execute(sql`insert into persons (id, tenant_id, email, display_name, auth_source) values
			(${TEAM}, ${T1}, 'team@oper.de', 'Team', 'local'),
			(${FREMD}, ${T2}, 'fremd@ballett.de', 'Fremd', 'local'),
			(${DOKS}, ${T1}, 'doks@oper.de', 'Doks', 'local')`);
		await db.execute(sql`insert into unit_members (unit_id, person_id, may_write_documents) values
			(${ZENTRAL}, ${TEAM}, false), (${EIGEN}, ${TEAM}, false), (${ZENTRAL}, ${DOKS}, true)`);
		await db.execute(sql`insert into role_assignments (person_id, role, scope, scope_unit_id) values
			(${TEAM}, 'hub_team', 'unit', ${ZENTRAL}), (${TEAM}, 'hub_team', 'unit', ${EIGEN})`);
		await db.execute(sql`insert into files (id, name, mime, kind, size, key_enc, created_by) values
			(${DATEI}, 'plan.pdf', 'application/pdf', 'pdf', 100, 'x', ${TEAM})`);
	});

	it('nur wer den Hub pflegt, ändert Links; Adressen werden geprüft', async () => {
		await hi.linkHinzufuegen(team, ZENTRAL, {
			label: 'Plan',
			description: '',
			url: 'example.org',
			icon: 'kalender'
		});
		await expect(
			hi.linkHinzufuegen(team, ZENTRAL, {
				label: 'x',
				description: '',
				url: 'javascript:alert(1)',
				icon: 'link'
			})
		).rejects.toThrow(/ungültig/);
		await expect(
			hi.linkHinzufuegen(fremd, ZENTRAL, {
				label: 'x',
				description: '',
				url: 'example.org',
				icon: 'link'
			})
		).rejects.toThrow();
		await expect(
			hi.linkHinzufuegen(doks, ZENTRAL, {
				label: 'x',
				description: '',
				url: 'example.org',
				icon: 'link'
			})
		).rejects.toThrow();
		const inhalte = await hi.hubInhalte(ZENTRAL);
		expect(inhalte.links.map((l) => l.url)).toEqual(['https://example.org/']);
	});

	it('Ansprechpersonen: zentrale Hubs aus allen Mandanten, sonst nur der eigene', async () => {
		await hi.kontaktHinzufuegen(team, ZENTRAL, 'fremd@ballett.de', 'Kostüme');
		await expect(hi.kontaktHinzufuegen(team, EIGEN, 'fremd@ballett.de', '')).rejects.toThrow();
		expect((await hi.hubInhalte(ZENTRAL)).kontakte[0]).toMatchObject({
			name: 'Fremd',
			task: 'Kostüme'
		});
	});

	it('Recht „Dokumente“ reicht für Ordner und Dokumente', async () => {
		await hi.ordnerAnlegen(doks, ZENTRAL, 'Noten');
		await expect(hi.ordnerAnlegen(fremd, ZENTRAL, 'x')).rejects.toThrow();
		const [ordner] = (await hi.hubInhalte(ZENTRAL)).ordner;
		// Datei gehört TEAM: Fremde Uploads lassen sich nicht übernehmen
		await expect(hi.dokumenteHinzufuegen(doks, ZENTRAL, [DATEI], ordner.id)).rejects.toThrow();
	});

	it('Dateien eines Hubs sieht nur, wer den Hub sieht', async () => {
		await hi.dokumenteHinzufuegen(team, EIGEN, [DATEI], null);
		expect(await hi.hubDateiErlaubt(team, DATEI)).toBe(true);
		// Nicht zentraler Hub eines anderen Mandanten
		expect(await hi.hubDateiErlaubt(fremd, DATEI)).toBe(false);
	});

	it('das letzte Mitglied des Hub-Teams bleibt', async () => {
		await expect(units.removeMember(team, EIGEN, TEAM, '127.0.0.1')).rejects.toThrow(
			/Mindestens eine Person/
		);
		await expect(
			units.setMemberRights(
				team,
				EIGEN,
				TEAM,
				{
					isPrimary: false,
					mayWriteNews: false,
					mayWriteFaqs: false,
					mayWriteEvents: false,
					mayWriteBehindScenes: false,
					verwaltet: false
				},
				'127.0.0.1'
			)
		).rejects.toThrow(/Mindestens eine Person/);
	});

	it('das Hub-Team holt weitere Personen ins Hub-Team, auch aus anderen Mandanten (zentral)', async () => {
		await units.addMember(team, ZENTRAL, 'fremd@ballett.de', '127.0.0.1');
		await units.setMemberRights(
			team,
			ZENTRAL,
			FREMD,
			{
				isPrimary: false,
				mayWriteNews: true,
				mayWriteFaqs: false,
				mayWriteEvents: false,
				mayWriteBehindScenes: false,
				verwaltet: true
			},
			'127.0.0.1'
		);
		const r = await db.execute(
			sql`select 1 from role_assignments where person_id = ${FREMD} and role = 'hub_team' and scope_unit_id = ${ZENTRAL}`
		);
		expect(r.length).toBe(1);
		await expect(units.addMember(team, EIGEN, 'fremd@ballett.de', '127.0.0.1')).rejects.toThrow();
	});
});
