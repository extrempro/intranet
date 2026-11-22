/**
 * Entra-Abgleich mit echter Datenbank und gespieltem Graph. Läuft nur mit
 * TEST_DATABASE_URL; nutzt eine eigene Datenbank <name>_entra.
 */
import { sql } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import type { GraphClient } from './entra-sync.ts';
import type { GraphUser } from './entra-sync-plan.ts';

const url = process.env.TEST_DATABASE_URL;
const T = {
	oper: '00000000-0000-0000-0000-000000000001',
	zweithaus: '00000000-0000-0000-0000-000000000002'
};
const G = {
	zugang: '10000000-0000-0000-0000-000000000001',
	redaktion: '10000000-0000-0000-0000-000000000002'
};
const P = {
	bleibt: '00000000-0000-0000-0000-0000000000b1',
	wechselt: '00000000-0000-0000-0000-0000000000b2',
	geloescht: '00000000-0000-0000-0000-0000000000b3',
	ohneZugang: '00000000-0000-0000-0000-0000000000b4',
	vonEntraGesperrt: '00000000-0000-0000-0000-0000000000b5',
	vonVerwaltungGesperrt: '00000000-0000-0000-0000-0000000000b6',
	lokal: '00000000-0000-0000-0000-0000000000b7'
};
const oid = (n: number) => `20000000-0000-0000-0000-00000000000${n}`;

function fakeGraph(
	users: Record<string, { user: Partial<GraphUser>; groups: string[] }>,
	fehler?: Error
): GraphClient {
	return {
		async lookup(o) {
			if (fehler) throw fehler;
			const u = users[o];
			if (!u) return null;
			return {
				user: {
					id: o,
					displayName: null,
					mail: null,
					userPrincipalName: '',
					accountEnabled: true,
					...u.user
				},
				groupIds: u.groups
			};
		}
	};
}

describe.skipIf(!url)('Entra-Abgleich', () => {
	let db: typeof import('../db/index.ts').db;
	let sync: typeof import('./entra-sync.ts');

	beforeAll(async () => {
		const { freshDatabase, migrateWithRetry } = await import('../db/test-db.ts');
		process.env.DATABASE_URL = await freshDatabase(url as string, 'entra');
		process.env.APP_DATABASE_PASSWORD ??= 'test-app-passwort';
		process.env.ENTRA_TENANT_ID = '30000000-0000-0000-0000-000000000001';
		process.env.ENTRA_CLIENT_ID = '30000000-0000-0000-0000-000000000002';
		process.env.ENTRA_CLIENT_SECRET = 'nur-fuer-den-test';
		process.env.ENTRA_ACCESS_GROUP_ID = G.zugang;
		db = (await import('../db/index.ts')).db;
		const { runMigrations } = await import('../db/migrate.ts');
		await migrateWithRetry(() => runMigrations());
		sync = await import('./entra-sync.ts');

		await db.execute(sql`
			insert into tenants (id, name, short_name, is_main) values
				(${T.oper}, 'Oper', 'BH', true), (${T.zweithaus}, 'Zweithaus', 'ZH', false)`);
		await db.execute(sql`
			insert into tenant_domains (domain, tenant_id) values ('oper.test', ${T.oper}), ('zweithaus.test', ${T.zweithaus})`);
		await db.execute(sql`
			insert into entra_group_roles (group_id, role, scope, scope_tenant_id) values
				(${G.redaktion}, 'redaktion', 'tenant', ${T.oper})`);
		await db.execute(sql`
			insert into persons (id, tenant_id, email, display_name, auth_source, entra_oid, status, disabled_at, disabled_by) values
				(${P.bleibt}, ${T.oper}, 'a@oper.test', 'Anna', 'entra', ${oid(1)}, 'active', null, null),
				(${P.wechselt}, ${T.oper}, 'b@oper.test', 'Ben', 'entra', ${oid(2)}, 'active', null, null),
				(${P.geloescht}, ${T.oper}, 'c@oper.test', 'Cem', 'entra', ${oid(3)}, 'active', null, null),
				(${P.ohneZugang}, ${T.oper}, 'd@oper.test', 'Dora', 'entra', ${oid(4)}, 'active', null, null),
				(${P.vonEntraGesperrt}, ${T.oper}, 'e@oper.test', 'Eli', 'entra', ${oid(5)}, 'disabled', now(), 'entra'),
				(${P.vonVerwaltungGesperrt}, ${T.oper}, 'f@oper.test', 'Fiete', 'entra', ${oid(6)}, 'disabled', now(), 'verwaltung'),
				(${P.lokal}, ${T.oper}, 'g@oper.test', 'Gesa', 'local', null, 'active', null, null)`);
		// Ben hat eine Rolle aus Entra und eine von Hand
		await db.execute(sql`
			insert into role_assignments (person_id, role, scope, scope_tenant_id, source, entra_group_id) values
				(${P.wechselt}, 'redaktion', 'tenant', ${T.oper}, 'entra', ${G.redaktion}),
				(${P.wechselt}, 'moderation_schwarzes_brett', 'tenant', ${T.oper}, 'manual', null)`);
		await db.execute(sql`
			insert into sessions (id, person_id, auth_method, expires_at) values
				('sitzung-dora', ${P.ohneZugang}, 'entra', now() + interval '1 day')`);
	});

	const alle = {
		[oid(1)]: { user: { displayName: 'Anna', mail: 'a@oper.test' }, groups: [G.zugang] },
		[oid(2)]: { user: { displayName: 'Ben B.', mail: 'b@zweithaus.test' }, groups: [G.zugang] },
		[oid(4)]: { user: { displayName: 'Dora', mail: 'd@oper.test' }, groups: [] },
		[oid(5)]: { user: { displayName: 'Eli', mail: 'e@oper.test' }, groups: [G.zugang] },
		[oid(6)]: { user: { displayName: 'Fiete', mail: 'f@oper.test' }, groups: [G.zugang] }
	};

	it('hält bei Rechtefehlern an und ändert nichts', async () => {
		const { GraphError } = await import('./entra.ts');
		const s = await sync.runEntraSync({ graph: fakeGraph(alle, new GraphError(403, 'x')) });
		expect(s).toMatchObject({ ok: false, meldung: sync.BERECHTIGUNG_FEHLT });
		const [r] = await db.execute<{ n: number }>(
			sql`select count(*)::int as n from persons where status = 'disabled'`
		);
		expect(r.n).toBe(2);
	});

	it('gleicht ab, sperrt und gibt frei', async () => {
		const s = await sync.runEntraSync({ graph: fakeGraph(alle) });
		expect(s).toMatchObject({
			ok: true,
			geprueft: 5,
			aktualisiert: 1,
			rollen: 1,
			gesperrt: 2,
			freigegeben: 1,
			fehler: 0
		});
		const rows = await db.execute<{
			id: string;
			status: string;
			disabled_by: string | null;
			tenant_id: string;
			display_name: string;
		}>(sql`select id, status, disabled_by, tenant_id, display_name from persons`);
		const by = Object.fromEntries(rows.map((r) => [r.id, r]));
		expect(by[P.bleibt].status).toBe('active');
		expect(by[P.wechselt]).toMatchObject({ tenant_id: T.zweithaus, display_name: 'Ben B.' });
		expect(by[P.geloescht]).toMatchObject({ status: 'disabled', disabled_by: 'entra' });
		expect(by[P.ohneZugang]).toMatchObject({ status: 'disabled', disabled_by: 'entra' });
		expect(by[P.vonEntraGesperrt]).toMatchObject({ status: 'active', disabled_by: null });
		expect(by[P.vonVerwaltungGesperrt]).toMatchObject({
			status: 'disabled',
			disabled_by: 'verwaltung'
		});
		expect(by[P.lokal].status).toBe('active');

		// Entra-Rolle weg, Rolle von Hand bleibt
		const rollen = await db.execute<{ role: string; source: string }>(
			sql`select role, source from role_assignments where person_id = ${P.wechselt}`
		);
		expect(rollen).toEqual([{ role: 'moderation_schwarzes_brett', source: 'manual' }]);
		const sitzungen = await db.execute(
			sql`select 1 from sessions where person_id = ${P.ohneZugang}`
		);
		expect(sitzungen.length).toBe(0);
		expect((await sync.lastSync())?.gesperrt).toBe(2);
	});

	it('zweiter Lauf ändert nichts mehr', async () => {
		const s = await sync.runEntraSync({ graph: fakeGraph(alle) });
		expect(s).toMatchObject({ ok: true, aktualisiert: 0, rollen: 0, gesperrt: 0, freigegeben: 0 });
	});

	it('hält an, wenn zu viele Konten gesperrt würden', async () => {
		const viele = Array.from(
			{ length: 12 },
			(_, i) => `40000000-0000-0000-0000-0000000000${String(i).padStart(2, '0')}`
		);
		for (const [i, o] of viele.entries())
			await db.execute(sql`
				insert into persons (tenant_id, email, display_name, auth_source, entra_oid)
				values (${T.oper}, ${`x${i}@oper.test`}, ${`X${i}`}, 'entra', ${o})`);
		const s = await sync.runEntraSync({ graph: fakeGraph(alle) });
		expect(s?.ok).toBe(false);
		expect(s?.angehalten).toEqual({ sperren: 12, aktiv: 15 });
		const [r] = await db.execute<{ n: number }>(
			sql`select count(*)::int as n from persons where status = 'disabled'`
		);
		expect(r.n).toBe(3);
		const t = await sync.runEntraSync({ graph: fakeGraph(alle), trotzdem: true });
		expect(t).toMatchObject({ ok: true, gesperrt: 12 });
	});
});
