/**
 * Konten ausblenden (Kap. 14): für andere nicht in Personen, Suche, Profil und
 * Teams; die Person selbst und die Verwaltung sehen es. Nur Admins des Mandanten.
 */
import { sql } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Principal } from './auth/access.ts';

const url = process.env.TEST_DATABASE_URL;
const T1 = '00000000-0000-0000-0000-000000000001';
const T2 = '00000000-0000-0000-0000-000000000002';
const ABT = '00000000-0000-0000-0000-0000000000a1';
const TEST = '00000000-0000-0000-0000-0000000000b1';
const LESER = '00000000-0000-0000-0000-0000000000b2';
const ADMIN = '00000000-0000-0000-0000-0000000000b3';
const FREMD_ADMIN = '00000000-0000-0000-0000-0000000000b4';

const ohne = (personId: string, tenantId = T1): Principal => ({
	personId,
	tenantId,
	roles: [],
	memberships: []
});

describe.skipIf(!url)('Konten ausblenden', () => {
	let db: typeof import('./db/index.ts').db;
	let people: typeof import('./people.ts');
	let users: typeof import('./users.ts');
	let departments: typeof import('./departments.ts');
	const admin: Principal = {
		...ohne(ADMIN),
		roles: [{ role: 'mandanten_admin', scope: 'tenant', scopeTenantId: T1, scopeUnitId: null }]
	};
	const fremdAdmin: Principal = {
		...ohne(FREMD_ADMIN, T2),
		roles: [{ role: 'mandanten_admin', scope: 'tenant', scopeTenantId: T2, scopeUnitId: null }]
	};

	beforeAll(async () => {
		const { freshDatabase, migrateWithRetry } = await import('./db/test-db.ts');
		process.env.DATABASE_URL = await freshDatabase(url as string, 'ausblenden');
		process.env.APP_DATABASE_PASSWORD ??= 'test-app-passwort';
		db = (await import('./db/index.ts')).db;
		const { runMigrations } = await import('./db/migrate.ts');
		await migrateWithRetry(() => runMigrations());
		people = await import('./people.ts');
		users = await import('./users.ts');
		departments = await import('./departments.ts');
		await db.execute(sql`insert into tenants (id, name, short_name, is_main) values
			(${T1}, 'Haus A', 'A', true), (${T2}, 'Haus B', 'B', false)`);
		await db.execute(sql`insert into units (id, tenant_id, type, name, slug) values
			(${ABT}, ${T1}, 'abteilung', 'Technik', 'technik')`);
		await db.execute(sql`insert into persons (id, tenant_id, email, display_name, auth_source) values
			(${TEST}, ${T1}, 'test@example.org', 'Testkonto Technik', 'local'),
			(${LESER}, ${T1}, 'leser@example.org', 'Lea Leser', 'local'),
			(${ADMIN}, ${T1}, 'admin@example.org', 'Ada Admin', 'local'),
			(${FREMD_ADMIN}, ${T2}, 'fremd@example.org', 'Fred Fremd', 'local')`);
		await db.execute(sql`insert into unit_members (unit_id, person_id) values (${ABT}, ${TEST})`);
	});

	const inListe = async (p: Principal) =>
		(await people.listPeople(p, {})).personen.some((x) => x.id === TEST);

	it('nur Admins des Mandanten blenden aus; danach unsichtbar für andere', async () => {
		expect(await inListe(ohne(LESER))).toBe(true);
		await expect(users.setPersonHidden(ohne(LESER), TEST, true, '127.0.0.1')).rejects.toThrow();
		await expect(users.setPersonHidden(fremdAdmin, TEST, true, '127.0.0.1')).rejects.toThrow();
		await users.setPersonHidden(admin, TEST, true, '127.0.0.1');

		expect(await inListe(ohne(LESER))).toBe(false);
		expect(await people.searchPersons(ohne(LESER), 'Testkonto', 'testkonto:*')).toEqual([]);
		expect(await people.getPerson(ohne(LESER), TEST)).toBeNull();
		const d = await departments.getDepartment(ohne(LESER), 'technik');
		expect(JSON.stringify(d)).not.toContain('Testkonto');
		// Die Person selbst sieht ihr Profil, die Verwaltung das Konto
		expect(await people.getPerson(ohne(TEST), TEST)).not.toBeNull();
		expect((await users.listPersons(admin, 'Testkonto')).map((x) => x.hidden)).toEqual([true]);
		const [{ n }] = (await db.execute(
			sql`select count(*)::int as n from audit_log where action = 'person.hide' and entity_id = ${TEST}`
		)) as unknown as { n: number }[];
		expect(n).toBe(1);

		await users.setPersonHidden(admin, TEST, false, '127.0.0.1');
		expect(await inListe(ohne(LESER))).toBe(true);
	});
});
