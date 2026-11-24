/**
 * Abteilungsseite wie bei Hubs (Kap. 8.11): Aufbau, Schnellzugriff und Recht.
 * Läuft nur mit TEST_DATABASE_URL; eigene Datenbank <name>_einheitseite.
 */
import { sql } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Principal } from './auth/access.ts';

const url = process.env.TEST_DATABASE_URL;
const T = '00000000-0000-0000-0000-000000000001';
const ABT = '00000000-0000-0000-0000-0000000000a1';
const HUB = '00000000-0000-0000-0000-0000000000a2';
const P = {
	pflege: '00000000-0000-0000-0000-0000000000b1',
	mitglied: '00000000-0000-0000-0000-0000000000b2'
};
const pflege: Principal = {
	personId: P.pflege,
	tenantId: T,
	roles: [{ role: 'abteilungsverwaltung', scope: 'unit', scopeTenantId: null, scopeUnitId: ABT }],
	memberships: []
};
const mitglied: Principal = { personId: P.mitglied, tenantId: T, roles: [], memberships: [] };

const daten = (o: object) =>
	JSON.stringify({
		aufbau: { reiter: ['team', 'neues'], ueberblick: ['schnellzugriff', 'zustaendigkeiten'] },
		links: [
			{ label: 'Ticket', description: 'Störung melden', url: 'example.com/ticket', icon: 'link' }
		],
		dokumente: [],
		...o
	});

describe.skipIf(!url)('Abteilungsseite wie Hubs', () => {
	let db: typeof import('./db/index.ts').db;
	let es: typeof import('./einheit-seite.ts');
	let dep: typeof import('./departments.ts');

	beforeAll(async () => {
		const { freshDatabase, migrateWithRetry } = await import('./db/test-db.ts');
		process.env.DATABASE_URL = await freshDatabase(url as string, 'einheitseite');
		process.env.APP_DATABASE_PASSWORD ??= 'test-app-passwort';
		db = (await import('./db/index.ts')).db;
		const { runMigrations } = await import('./db/migrate.ts');
		await migrateWithRetry(() => runMigrations());
		es = await import('./einheit-seite.ts');
		dep = await import('./departments.ts');
		await db.execute(
			sql`insert into tenants (id, name, short_name, is_main) values (${T}, 'Haus A', 'HA', true)`
		);
		await db.execute(sql`
			insert into units (id, tenant_id, type, name, slug) values
				(${ABT}, ${T}, 'abteilung', 'IT', 'it'),
				(${HUB}, ${T}, 'hub', 'Chor', 'chor')`);
		await db.execute(sql`
			insert into persons (id, tenant_id, email, display_name, auth_source) values
				(${P.pflege}, ${T}, 'p@haus-a.example', 'Pia Pflege', 'local'),
				(${P.mitglied}, ${T}, 'm@haus-a.example', 'Max Mitglied', 'local')`);
		await db.execute(sql`
			insert into role_assignments (person_id, role, scope, scope_unit_id) values
				(${P.pflege}, 'abteilungsverwaltung', 'unit', ${ABT})`);
	});

	it('ohne Pflege-Rolle kein Speichern', async () => {
		await expect(
			es.einheitSeiteSpeichern(mitglied, ABT, es.seitenDatenLesen(daten({})), [], '127.0.0.1')
		).rejects.toThrow(/Recht/);
	});

	it('Abteilungsverwaltung speichert Aufbau und Schnellzugriff; die Seite zeigt sie', async () => {
		const r = await es.einheitSeiteSpeichern(
			pflege,
			ABT,
			es.seitenDatenLesen(daten({})),
			[],
			'127.0.0.1'
		);
		expect(r).toEqual({});
		const e = await dep.getDepartment(mitglied, 'it');
		expect(e?.layout.reiter.slice(0, 2)).toEqual(['team', 'neues']);
		expect(e?.layout.reiter).toHaveLength(6);
		expect(e?.layout.ueberblick).toEqual(['schnellzugriff', 'zustaendigkeiten']);
		expect(e?.links).toMatchObject([
			{ label: 'Ticket', url: 'https://example.com/ticket', extern: true }
		]);
		expect(e?.canDocs).toBe(false);
		expect((await dep.getDepartment(pflege, 'it'))?.canDocs).toBe(true);
	});

	it('ungültiges Ziel: Fehler, nichts halb gespeichert', async () => {
		const r = await es.einheitSeiteSpeichern(
			pflege,
			ABT,
			es.seitenDatenLesen(daten({ links: [{ label: 'Kaputt', url: 'javascript:alert(1)' }] })),
			[],
			'127.0.0.1'
		);
		expect(r.fehler).toMatch(/Ziel/);
		const e = await dep.getDepartment(mitglied, 'it');
		expect(e?.links.map((l) => l.label)).toEqual(['Ticket']);
	});

	it('Hubs nicht über die Abteilungsseite', async () => {
		const admin: Principal = {
			...pflege,
			roles: [{ role: 'system_admin', scope: 'all', scopeTenantId: null, scopeUnitId: null }]
		};
		const r = await es.einheitSeiteSpeichern(
			admin,
			HUB,
			es.seitenDatenLesen(daten({})),
			[],
			'127.0.0.1'
		);
		expect(r.fehler).toMatch(/Hub bearbeiten/);
	});

	it('Protokoll', async () => {
		const [{ n }] = await db.execute(
			sql`select count(*)::int as n from audit_log where action = 'unit.page_save'`
		);
		expect(n).toBeGreaterThan(0);
	});
});
