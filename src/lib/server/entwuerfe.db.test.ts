/**
 * Entwürfe: nur die eigene Person sieht sie (Row-Level Security), Dateien im
 * Entwurf werden nicht nach 24 Stunden gelöscht, fremde Dateien gehören nie
 * dazu. Läuft nur mit TEST_DATABASE_URL; eigene Datenbank <name>_entwuerfe.
 */
import { sql } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Principal } from './auth/access.ts';

const url = process.env.TEST_DATABASE_URL;
const T = '00000000-0000-0000-0000-000000000001';
const ICH = '00000000-0000-0000-0000-0000000000b1';
const ANDERE = '00000000-0000-0000-0000-0000000000b2';
const BILD = '00000000-0000-4000-8000-00000000f001';
const ANHANG = '00000000-0000-4000-8000-00000000f002';
const FREMD = '00000000-0000-4000-8000-00000000f003';
const LOSE = '00000000-0000-4000-8000-00000000f004';

describe.skipIf(!url)('Entwürfe', () => {
	let db: typeof import('./db/index.ts').db;
	let ew: typeof import('./entwuerfe.ts');
	let store: typeof import('./files/store.ts');
	const ich: Principal = { personId: ICH, tenantId: T, roles: [], memberships: [] };
	const andere: Principal = { personId: ANDERE, tenantId: T, roles: [], memberships: [] };
	let id = '';

	beforeAll(async () => {
		const { freshDatabase, migrateWithRetry } = await import('./db/test-db.ts');
		process.env.DATABASE_URL = await freshDatabase(url as string, 'entwuerfe');
		process.env.APP_DATABASE_PASSWORD ??= 'test-app-passwort';
		db = (await import('./db/index.ts')).db;
		const { runMigrations } = await import('./db/migrate.ts');
		await migrateWithRetry(() => runMigrations());
		ew = await import('./entwuerfe.ts');
		store = await import('./files/store.ts');
		await db.execute(
			sql`insert into tenants (id, name, short_name, is_main) values (${T}, 'Oper', 'BH', true)`
		);
		await db.execute(sql`
			insert into persons (id, tenant_id, email, display_name, auth_source) values
				(${ICH}, ${T}, 'ich@oper.de', 'Ich', 'local'), (${ANDERE}, ${T}, 'du@oper.de', 'Du', 'local')`);
		await db.execute(sql`
			insert into files (id, name, mime, kind, size, key_enc, created_by, created_at) values
				(${BILD}, 'a.webp', 'image/webp', 'webp', 1000, 'x', ${ICH}, now() - interval '2 days'),
				(${ANHANG}, 'b.pdf', 'application/pdf', 'pdf', 1000, 'x', ${ICH}, now() - interval '2 days'),
				(${FREMD}, 'c.webp', 'image/webp', 'webp', 1000, 'x', ${ANDERE}, now() - interval '2 days'),
				(${LOSE}, 'd.webp', 'image/webp', 'webp', 1000, 'x', ${ICH}, now() - interval '2 days')`);
	});

	it('speichert eigene Dateien mit, fremde nicht', async () => {
		id = await ew.entwurfSpeichern(ich, 'news', null, [
			['titel', 'Sommerfest'],
			[
				'text',
				`<p>Hallo</p><img src="/dateien/${BILD}" alt="x"><img src="/dateien/${FREMD}" alt="y" onerror="alert(1)">`
			],
			['anhaenge', ANHANG]
		]);
		const rows = await db.execute(sql`select file_id from draft_files where draft_id = ${id}`);
		expect(rows.map((r) => r.file_id).sort()).toEqual([BILD, ANHANG].sort());
		expect((await ew.entwuerfeListe(ich)).map((e) => e.title)).toEqual(['Sommerfest']);
	});

	it('andere Personen sehen und ändern den Entwurf nicht', async () => {
		expect(await ew.entwuerfeListe(andere)).toEqual([]);
		expect(await ew.entwurfLaden(andere, id, 'news')).toBeNull();
		// Fremde ID beim Speichern: legt einen eigenen neuen Entwurf an
		const neu = await ew.entwurfSpeichern(andere, 'news', id, [['titel', 'Übernahme']]);
		expect(neu).not.toBe(id);
		await ew.entwurfLoeschen(andere, id);
		const geladen = await ew.entwurfLaden(ich, id, 'news');
		expect(geladen?.form.get('titel')).toBe('Sommerfest');
		// Falsche Art
		expect(await ew.entwurfLaden(ich, id, 'faq')).toBeNull();
		// Text wird beim Laden bereinigt
		expect(String(geladen?.form.get('text'))).not.toContain('onerror');
	});

	it('Dateien im Entwurf bleiben, lose werden aufgeräumt', async () => {
		await store.deleteOrphans();
		const ids = (await db.execute(sql`select id from files`)).map((r) => r.id);
		expect(ids).toContain(BILD);
		expect(ids).toContain(ANHANG);
		expect(ids).not.toContain(LOSE);
		// Dateien im Entwurf zählen beim Veröffentlichen weiter als eigene, freie Uploads
		expect((await store.ownUnlinkedFiles(ICH, [BILD, ANHANG])).sort()).toEqual(
			[BILD, ANHANG].sort()
		);
	});

	it('nach dem Löschen des Entwurfs werden die Dateien frei', async () => {
		await ew.entwurfLoeschen(ich, id);
		await store.deleteOrphans();
		const ids = (await db.execute(sql`select id from files`)).map((r) => r.id);
		expect(ids).not.toContain(BILD);
		expect(ids).not.toContain(ANHANG);
	});

	it('löscht lange unveränderte Entwürfe', async () => {
		const alt = await ew.entwurfSpeichern(ich, 'faq', null, [['frage', 'Alt?']]);
		await db.execute(
			sql`update drafts set updated_at = now() - interval '91 days' where id = ${alt}`
		);
		await ew.alteEntwuerfeLoeschen();
		expect(await ew.entwurfLaden(ich, alt, 'faq')).toBeNull();
	});
});
