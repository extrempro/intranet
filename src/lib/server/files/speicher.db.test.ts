/**
 * Speicherorte (Kap. 18): Ablage lokal und in S3, Umzug in beide Richtungen,
 * Verbindungsprüfung. Läuft mit TEST_DATABASE_URL; die S3-Teile zusätzlich nur
 * mit TEST_S3_ENDPOINT (z. B. lokaler Testspeicher, siehe CI).
 */
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sql } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';

const url = process.env.TEST_DATABASE_URL;
const s3 = process.env.TEST_S3_ENDPOINT;
const T = '00000000-0000-0000-0000-000000000001';
const ICH = '00000000-0000-0000-0000-0000000000b1';

describe.skipIf(!url)('Speicherorte', () => {
	let db: typeof import('../db/index.ts').db;
	let store: typeof import('./store.ts');
	let orte: typeof import('./speicherorte.ts');
	let umzug: typeof import('./umzug.ts');
	let verwaltung: typeof import('../speicher-verwaltung.ts');
	let ziel = '';

	beforeAll(async () => {
		const { freshDatabase, migrateWithRetry } = await import('../db/test-db.ts');
		process.env.DATABASE_URL = await freshDatabase(url as string, 'speicher');
		process.env.APP_DATABASE_PASSWORD ??= 'test-app-passwort';
		process.env.ENCRYPTION_KEY ??= Buffer.alloc(32, 7).toString('base64');
		process.env.FILES_DIR = await mkdtemp(join(tmpdir(), 'speicher-'));
		db = (await import('../db/index.ts')).db;
		const { runMigrations } = await import('../db/migrate.ts');
		await migrateWithRetry(() => runMigrations());
		store = await import('./store.ts');
		orte = await import('./speicherorte.ts');
		umzug = await import('./umzug.ts');
		verwaltung = await import('../speicher-verwaltung.ts');
		await db.execute(
			sql`insert into tenants (id, name, short_name, is_main) values (${T}, 'Haus', 'BH', true)`
		);
		await db.execute(sql`
			insert into persons (id, tenant_id, email, display_name, auth_source) values
				(${ICH}, ${T}, 'ich@example.org', 'Ich', 'local')`);
	});

	const bytes = (n: number) => new Uint8Array(Array.from({ length: n }, (_, i) => i % 251));

	it('legt lokal ab und liest wieder', async () => {
		const f = await store.storeBytes(bytes(1000), 'a.pdf', 'pdf', ICH, 'inhalte');
		const r = await store.readStored(f.id);
		expect(Buffer.from(r!.data)).toEqual(Buffer.from(bytes(1000)));
		expect(r!.storageTargetId).toBeNull();
		expect(r!.category).toBe('inhalte');
	});

	it('Zuordnung ohne gültigen Speicher bleibt lokal', async () => {
		await orte.zuordnungSetzen('inhalte', '00000000-0000-4000-8000-000000000999', ICH);
		expect(await orte.zielFuer('inhalte')).toBeNull();
		await orte.zuordnungSetzen('inhalte', null, ICH);
	});

	it('lehnt unsichere Endpoints ab', () => {
		const fd = new FormData();
		for (const [k, v] of Object.entries({
			name: 'X',
			endpoint: 'http://10.0.0.1',
			bucket: 'ab',
			accessKey: 'a',
			secret: 's'
		}))
			fd.set(k, v);
		const { felder } = verwaltung.s3EingabeLesen(fd);
		expect(felder.endpoint).toBeTruthy();
		expect(felder.bucket).toBeTruthy();
	});

	describe.skipIf(!s3)('mit S3', () => {
		beforeAll(async () => {
			process.env.S3_TEST_UNSICHER = '1';
			const w = {
				name: 'Test',
				endpoint: s3 as string,
				region: 'us-east-1',
				bucket: `intranet-test-${Date.now()}`,
				accessKey: process.env.TEST_S3_ACCESS_KEY ?? 'testzugang',
				secret: process.env.TEST_S3_SECRET_KEY ?? 'testgeheimnis-1234567890',
				pathStyle: true
			};
			// Bucket anlegen
			const { CreateBucketCommand } = await import('@aws-sdk/client-s3');
			const c = orte.s3Client(w, w.secret);
			await c.send(new CreateBucketCommand({ Bucket: w.bucket }));
			c.destroy();
			const pruefung = await verwaltung.eingabePruefen(w, null);
			expect(pruefung.ok, pruefung.meldung).toBe(true);
			ziel = await verwaltung.s3Speichern(w, null, pruefung);
		});

		it('falsches Secret: Prüfung schlägt verständlich fehl', async () => {
			const [t] = await db.execute<{ bucket: string }>(
				sql`select bucket from storage_targets where id = ${ziel}`
			);
			const r = await verbindungMitSecret(t.bucket, 'falsch');
			expect(r.ok).toBe(false);
			expect(r.meldung).toMatch(/Zugriff verweigert|Fehler/);
		});

		async function verbindungMitSecret(bucket: string, secret: string) {
			return verwaltung.eingabePruefen(
				{
					name: 'X',
					endpoint: s3 as string,
					region: 'us-east-1',
					bucket,
					accessKey: process.env.TEST_S3_ACCESS_KEY ?? 'testzugang',
					secret,
					pathStyle: true
				},
				null
			);
		}

		it('Medien der Mediathek: schreiben, lesen, alle eines Videos löschen', async () => {
			const vid = '00000000-0000-4000-8000-00000000aa01';
			for (const rel of ['master.m3u8', '360/index.m3u8', '360/s00000.m4s'])
				await orte.medienSchreiben(ziel, `videos/${vid}/${rel}`, Buffer.from(rel));
			expect((await orte.medienLesen(ziel, `videos/${vid}/360/index.m3u8`)).toString()).toBe(
				'360/index.m3u8'
			);
			await orte.medienLoeschen(ziel, vid);
			await expect(orte.medienLesen(ziel, `videos/${vid}/master.m3u8`)).rejects.toThrow();
		});

		it('neue Dateien landen im zugeordneten S3-Speicher und sind dort nur verschlüsselt', async () => {
			await orte.zuordnungSetzen('bilder', ziel, ICH);
			const f = await store.storeBytes(bytes(5000), 'b.jpg', 'jpeg', ICH, 'bilder');
			const r = await store.readStored(f.id);
			expect(r!.storageTargetId).toBe(ziel);
			expect(Buffer.from(r!.data)).toEqual(Buffer.from(bytes(5000)));
			const roh = await orte.objektLesen(ziel, f.id);
			expect(roh.includes(Buffer.from(bytes(5000)).subarray(0, 64))).toBe(false);
			await store.deleteStored([f.id]);
			await expect(orte.objektLesen(ziel, f.id)).rejects.toThrow();
		});

		it('zieht vorhandene Dateien hin und zurück, ohne Inhalt zu verlieren', async () => {
			await orte.zuordnungSetzen('plaene', null, ICH);
			const a = await store.storeBytes(bytes(3000), 'p1.pdf', 'pdf', ICH, 'plaene');
			const b = await store.storeBytes(bytes(4000), 'p2.pdf', 'pdf', ICH, 'plaene');
			await umzug.umzugStarten('plaene', ziel, ICH);
			await umzug.umzugArbeiten();
			for (const [f, n] of [
				[a, 3000],
				[b, 4000]
			] as const) {
				const r = await store.readStored(f.id);
				expect(r!.storageTargetId).toBe(ziel);
				expect(Buffer.from(r!.data)).toEqual(Buffer.from(bytes(n)));
			}
			const [m] = await db.execute<{ status: string; done: number }>(
				sql`select status, done from storage_moves order by started_at desc limit 1`
			);
			expect(m).toMatchObject({ status: 'fertig', done: 2 });
			// zurück nach lokal
			await umzug.umzugStarten('plaene', null, ICH);
			await umzug.umzugArbeiten();
			const r = await store.readStored(a.id);
			expect(r!.storageTargetId).toBeNull();
			await expect(orte.objektLesen(ziel, a.id)).rejects.toThrow();
		});

		it('Speicher mit Dateien lässt sich nicht löschen', async () => {
			const f = await store.storeBytes(bytes(10), 'c.jpg', 'jpeg', ICH, 'bilder');
			await expect(verwaltung.s3Loeschen(ziel)).rejects.toThrow(/noch 1 Dateien|zugeordnet/);
			await store.deleteStored([f.id]);
		});
	});
});
