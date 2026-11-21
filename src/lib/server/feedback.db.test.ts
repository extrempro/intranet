/**
 * Fehlermeldungen: nur System-Admins sehen sie samt Bildschirmfoto; das
 * Bildschirmfoto wird 30 Tage nach Abschluss gelöscht.
 * Läuft nur mit TEST_DATABASE_URL; eigene Datenbank <name>_rueckmeldung.
 */
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Principal } from './auth/access.ts';

const url = process.env.TEST_DATABASE_URL;
const T = '00000000-0000-0000-0000-000000000001';
const ICH = '00000000-0000-0000-0000-0000000000b1';
const ADMIN = '00000000-0000-0000-0000-0000000000b2';
const SYS = '00000000-0000-0000-0000-0000000000b3';

/** Kleinstes gültiges JPEG (1 × 1 Pixel) */
const JPEG = Buffer.from(
	'/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
	'base64'
);

describe.skipIf(!url)('Fehlermeldungen mit Bildschirmfoto', () => {
	let db: typeof import('./db/index.ts').db;
	let fb: typeof import('./feedback.ts');
	const ich: Principal = { personId: ICH, tenantId: T, roles: [], memberships: [] };
	const admin: Principal = {
		personId: ADMIN,
		tenantId: T,
		roles: [{ role: 'mandanten_admin', scope: 'tenant', scopeTenantId: T, scopeUnitId: null }],
		memberships: []
	};
	const sys: Principal = {
		personId: SYS,
		tenantId: T,
		roles: [{ role: 'system_admin', scope: 'all', scopeTenantId: null, scopeUnitId: null }],
		memberships: []
	};
	const technik = {
		version: '1.0.0',
		fenster: '800 × 600',
		browser: 'UA',
		teams: false,
		fehler: []
	};

	beforeAll(async () => {
		process.env.FILES_DIR = await mkdtemp(join(tmpdir(), 'rueckmeldung-'));
		process.env.ENCRYPTION_KEY ??= randomBytes(32).toString('base64');
		const { freshDatabase, migrateWithRetry } = await import('./db/test-db.ts');
		process.env.DATABASE_URL = await freshDatabase(url as string, 'rueckmeldung');
		process.env.APP_DATABASE_PASSWORD ??= 'test-app-passwort';
		db = (await import('./db/index.ts')).db;
		const { runMigrations } = await import('./db/migrate.ts');
		await migrateWithRetry(() => runMigrations());
		fb = await import('./feedback.ts');
		await db.execute(sql`
			insert into tenants (id, name, short_name, is_main) values (${T}, 'Oper', 'HSO', true)`);
		await db.execute(sql`
			insert into persons (id, tenant_id, email, display_name, auth_source) values
				(${ICH}, ${T}, 'ich@oper.de', 'Ich', 'local'),
				(${ADMIN}, ${T}, 'admin@oper.de', 'Admin', 'local'),
				(${SYS}, ${T}, 'sys@oper.de', 'Sys', 'local')`);
		await db.execute(sql`
			insert into role_assignments (person_id, role, scope, scope_tenant_id) values
				(${ADMIN}, 'mandanten_admin', 'tenant', ${T}),
				(${SYS}, 'system_admin', 'all', null)`);
	});

	const fehlerId = async () =>
		(
			await db.execute<{ id: string; bild: string | null }>(
				sql`select id, screenshot_file_id as bild from feedback where kind = 'fehler' order by created_at desc limit 1`
			)
		)[0];

	it('speichert Fehler mit Angaben und Bild; lehnt kaputte Bilder ab', async () => {
		const kaputt = await fb.createFeedback(
			ich,
			{ kind: 'fehler', text: 'Geht nicht', page: '/kalender' },
			{ technik, screenshot: new Uint8Array(randomBytes(500)) }
		);
		expect(kaputt.ok).toBe(false);
		const r = await fb.createFeedback(
			ich,
			{ kind: 'fehler', text: 'Geht nicht', page: '/kalender' },
			{ technik, screenshot: new Uint8Array(JPEG) }
		);
		expect(r.ok).toBe(true);
		const f = await fehlerId();
		expect(f.bild).toBeTruthy();
		// Idee: ohne Angaben und Bild, auch wenn welche mitkommen
		await fb.createFeedback(
			ich,
			{ kind: 'idee', text: 'Mehr Farbe bitte', page: '/' },
			{ technik, screenshot: new Uint8Array(JPEG) }
		);
		const [idee] = await db.execute<{ t: unknown; b: string | null }>(
			sql`select technik as t, screenshot_file_id as b from feedback where kind = 'idee'`
		);
		expect(idee).toEqual({ t: null, b: null });
	});

	it('Fehler sehen nur System-Admins, Ideen auch die Mandanten-Verwaltung', async () => {
		const f = await fehlerId();
		expect((await fb.listFeedback(admin, {})).map((r) => r.kind)).toEqual(['idee']);
		expect(await fb.getFeedback(admin, f.id)).toBeNull();
		expect(await fb.feedbackScreenshotAllowed(admin, f.bild!)).toBe(false);
		expect(await fb.feedbackScreenshotAllowed(ich, f.bild!)).toBe(false);
		expect((await fb.getFeedback(sys, f.id))?.technik).toEqual(technik);
		expect(await fb.feedbackScreenshotAllowed(sys, f.bild!)).toBe(true);
		expect((await fb.listFeedback(sys, {})).length).toBe(2);
	});

	it('löscht das Bildschirmfoto 30 Tage nach Abschluss, die Meldung bleibt', async () => {
		const f = await fehlerId();
		await db.execute(
			sql`update feedback set status = 'erledigt', closed_at = now() - interval '29 days' where id = ${f.id}`
		);
		await fb.feedbackRetention();
		expect((await fehlerId()).bild).toBe(f.bild);
		await db.execute(
			sql`update feedback set closed_at = now() - interval '31 days' where id = ${f.id}`
		);
		await fb.feedbackRetention();
		const danach = await fehlerId();
		expect(danach.id).toBe(f.id);
		expect(danach.bild).toBeNull();
		const [{ n }] = await db.execute<{ n: number }>(
			sql`select count(*)::int as n from files where id = ${f.bild}`
		);
		expect(n).toBe(0);
	});
});
