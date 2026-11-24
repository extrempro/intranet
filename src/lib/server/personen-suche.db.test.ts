/**
 * Personensuche für Teams (Kap. 5.2) mit echter Datenbank und nachgebildetem
 * Graph: lokale und Entra-Treffer, Mandant, Recht, Anlegen beim Hinzufügen.
 * Läuft nur mit TEST_DATABASE_URL; eigene Datenbank <name>_personensuche.
 */
import { sql } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Principal } from './auth/access.ts';
import type { GraphClient } from './auth/entra-sync.ts';

const url = process.env.TEST_DATABASE_URL;
const A = '00000000-0000-0000-0000-000000000001';
const B = '00000000-0000-0000-0000-000000000002';
const U = '00000000-0000-0000-0000-0000000000a1';
const ZUGANG = '11111111-1111-4111-8111-111111111111';
const GRUPPE_RED = '22222222-2222-4222-8222-222222222222';
const P = {
	verwaltung: '00000000-0000-0000-0000-0000000000b1',
	lokal: '00000000-0000-0000-0000-0000000000b2',
	fremd: '00000000-0000-0000-0000-0000000000b3'
};
const OID = {
	neu: 'aaaaaaaa-0000-4000-8000-000000000001',
	schonDa: 'aaaaaaaa-0000-4000-8000-000000000002',
	andererMandant: 'aaaaaaaa-0000-4000-8000-000000000003',
	gesperrt: 'aaaaaaaa-0000-4000-8000-000000000004',
	ohneZugang: 'aaaaaaaa-0000-4000-8000-000000000005'
};

const pr = (personId: string, roles: Principal['roles'] = []): Principal => ({
	personId,
	tenantId: A,
	roles,
	memberships: []
});

const graphSuche = {
	suchen: async () => [
		{ id: OID.neu, displayName: 'Lena Neu', mail: 'lena@haus-a.example', jobTitle: 'Inspizienz' },
		{ id: OID.schonDa, displayName: 'Lena Lokal', mail: 'lokal@haus-a.example' },
		{ id: OID.andererMandant, displayName: 'Lena Fremd', mail: 'lena@haus-b.example' },
		{
			id: OID.gesperrt,
			displayName: 'Lena Aus',
			mail: 'aus@haus-a.example',
			accountEnabled: false
		},
		{ id: 'kein-guid', displayName: 'Lena Kaputt', mail: 'x@haus-a.example' }
	]
};

const graphLookup: GraphClient = {
	async lookup(oid) {
		if (oid === OID.neu)
			return {
				user: {
					id: oid,
					displayName: 'Lena Neu',
					givenName: 'Lena',
					mail: 'lena@haus-a.example',
					userPrincipalName: 'lena@haus-a.example'
				},
				groupIds: [ZUGANG, GRUPPE_RED]
			};
		if (oid === OID.ohneZugang)
			return {
				user: {
					id: oid,
					displayName: 'Ohne',
					mail: null,
					userPrincipalName: 'ohne@haus-a.example'
				},
				groupIds: []
			};
		if (oid === OID.andererMandant)
			return {
				user: {
					id: oid,
					displayName: 'Lena Fremd',
					mail: 'lena@haus-b.example',
					userPrincipalName: 'lena@haus-b.example'
				},
				groupIds: [ZUGANG]
			};
		return null;
	}
};

describe.skipIf(!url)('Personensuche für Teams', () => {
	let db: typeof import('./db/index.ts').db;
	let ps: typeof import('./personen-suche.ts');
	const verwaltung = pr(P.verwaltung, [
		{ role: 'mandanten_admin', scope: 'tenant', scopeTenantId: A, scopeUnitId: null }
	]);

	beforeAll(async () => {
		const { freshDatabase, migrateWithRetry } = await import('./db/test-db.ts');
		process.env.DATABASE_URL = await freshDatabase(url as string, 'personensuche');
		process.env.APP_DATABASE_PASSWORD ??= 'test-app-passwort';
		process.env.ENTRA_TENANT_ID = '33333333-3333-4333-8333-333333333333';
		process.env.ENTRA_CLIENT_ID = '44444444-4444-4444-8444-444444444444';
		process.env.ENTRA_CLIENT_SECRET = 'geheim';
		process.env.ENTRA_ACCESS_GROUP_ID = ZUGANG;
		db = (await import('./db/index.ts')).db;
		const { runMigrations } = await import('./db/migrate.ts');
		await migrateWithRetry(() => runMigrations());
		ps = await import('./personen-suche.ts');
		await db.execute(sql`
			insert into tenants (id, name, short_name, is_main) values
				(${A}, 'Haus A', 'HA', true), (${B}, 'Haus B', 'HB', false)`);
		await db.execute(sql`
			insert into tenant_domains (domain, tenant_id) values
				('haus-a.example', ${A}), ('haus-b.example', ${B})`);
		await db.execute(sql`
			insert into units (id, tenant_id, type, name, slug, is_central) values
				(${U}, ${A}, 'stabsstelle', 'Stab', 'stab', true)`);
		await db.execute(sql`
			insert into persons (id, tenant_id, email, display_name, auth_source, entra_oid) values
				(${P.verwaltung}, ${A}, 'v@haus-a.example', 'Vera Verwaltung', 'local', null),
				(${P.lokal}, ${A}, 'lokal@haus-a.example', 'Lena Lokal', 'entra', ${OID.schonDa}),
				(${P.fremd}, ${B}, 'f@haus-b.example', 'Lena Anderswo', 'local', null)`);
		await db.execute(sql`
			insert into entra_group_roles (group_id, role, scope, scope_tenant_id) values
				(${GRUPPE_RED}, 'redaktion', 'tenant', ${A})`);
	});

	it('ohne Pflege-Rolle keine Suche', async () => {
		await expect(ps.teamPersonenSuchen(pr(P.lokal), U, 'Lena', graphSuche)).rejects.toThrow();
	});

	it('findet lokale Personen des Mandanten und neue aus Entra', async () => {
		const t = await ps.teamPersonenSuchen(verwaltung, U, 'Lena', graphSuche);
		expect(t.map((x) => x.name)).toEqual(['Lena Lokal', 'Lena Neu']);
		expect(t[1]).toMatchObject({
			id: `entra:${OID.neu}`,
			entra: true,
			position: 'Inspizienz',
			mandant: 'HA'
		});
	});

	it('Entra nicht erreichbar: lokale Treffer bleiben', async () => {
		const t = await ps.teamPersonenSuchen(verwaltung, U, 'Lena', {
			suchen: async () => {
				throw new Error('Graph weg');
			}
		});
		expect(t.map((x) => x.name)).toEqual(['Lena Lokal']);
	});

	it('Entra-Treffer anlegen: Mandant und Rollen wie bei der Anmeldung, noch nicht angemeldet', async () => {
		const id = await ps.personAusWahl(verwaltung, U, `entra:${OID.neu}`, '127.0.0.1', graphLookup);
		const [row] = await db.execute(
			sql`select tenant_id, auth_source, last_login_at, given_name, status from persons where id = ${id}`
		);
		expect(row).toMatchObject({
			tenant_id: A,
			auth_source: 'entra',
			last_login_at: null,
			given_name: 'Lena',
			status: 'active'
		});
		const rollen = await db.execute(
			sql`select role, source from role_assignments where person_id = ${id}`
		);
		expect(rollen).toEqual([{ role: 'redaktion', source: 'entra' }]);
		// Zweites Mal: dieselbe Person, kein neues Konto
		expect(
			await ps.personAusWahl(verwaltung, U, `entra:${OID.neu}`, '127.0.0.1', graphLookup)
		).toBe(id);
		// Jetzt lokal, nicht mehr als Entra-Treffer
		const t = await ps.teamPersonenSuchen(verwaltung, U, 'Lena', graphSuche);
		expect(t.filter((x) => x.entra)).toEqual([]);
	});

	it('ohne Zugangsgruppe, anderer Mandant oder unbekannt: kein Konto', async () => {
		await expect(
			ps.personAusWahl(verwaltung, U, `entra:${OID.ohneZugang}`, '127.0.0.1', graphLookup)
		).rejects.toThrow(/Zugangsgruppe/);
		await expect(
			ps.personAusWahl(verwaltung, U, `entra:${OID.andererMandant}`, '127.0.0.1', graphLookup)
		).rejects.toThrow(/Mandanten/);
		await expect(
			ps.personAusWahl(verwaltung, U, `entra:${OID.gesperrt}`, '127.0.0.1', graphLookup)
		).rejects.toThrow(/nicht \(mehr\)/);
		await expect(
			ps.personAusWahl(pr(P.lokal), U, `entra:${OID.neu}`, '127.0.0.1', graphLookup)
		).rejects.toThrow();
		const [{ n }] = await db.execute(sql`select count(*)::int as n from persons`);
		expect(n).toBe(4);
	});

	it('lokale Wahl bleibt unverändert', async () => {
		expect(await ps.personAusWahl(verwaltung, U, P.lokal, '127.0.0.1', graphLookup)).toBe(P.lokal);
	});
});
