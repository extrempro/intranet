/**
 * Mediathek (Kap. 8.15): Rechte, Sichtbarkeit (RLS, Mandanten), Entwürfe,
 * Hochladen in Teilen, Umwandlung (mit ffmpeg, falls vorhanden), Ausliefern,
 * Untertitel, Kapitel, Veröffentlichen, Löschen. Läuft nur mit TEST_DATABASE_URL.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { mkdtemp, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { sql } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Membership, Principal } from './auth/access.ts';

const url = process.env.TEST_DATABASE_URL;
const ffmpeg = spawnSync('ffmpeg', ['-version']).status === 0;
const T1 = '00000000-0000-0000-0000-000000000001';
const T2 = '00000000-0000-0000-0000-000000000002';
const ZENTRAL = '00000000-0000-0000-0000-0000000000a1';
const EIGEN = '00000000-0000-0000-0000-0000000000a2';
const PFLEGE = '00000000-0000-0000-0000-0000000000b1';
const LESER = '00000000-0000-0000-0000-0000000000b2';
const FREMD = '00000000-0000-0000-0000-0000000000b3';

const mitglied = (unitId: string, media = false): Membership => ({
	unitId,
	isPrimary: false,
	mayWriteNews: false,
	mayWriteFaqs: false,
	mayWriteEvents: false,
	mayWriteBehindScenes: false,
	mayWriteMedia: media
});

const VTT = `WEBVTT

00:00.000 --> 00:01.500
<b>Hallo</b> <script>x</script>Welt

00:01.500 --> 00:02.000
Zweite Zeile
`;

describe.skipIf(!url)('Mediathek', () => {
	let db: typeof import('./db/index.ts').db;
	let m: typeof import('./mediathek.ts');
	let arbeit = '';
	const pflege: Principal = {
		personId: PFLEGE,
		tenantId: T1,
		roles: [],
		memberships: [mitglied(ZENTRAL, true), mitglied(EIGEN, true)]
	};
	const leser: Principal = {
		personId: LESER,
		tenantId: T1,
		roles: [],
		memberships: [mitglied(ZENTRAL)]
	};
	const fremd: Principal = { personId: FREMD, tenantId: T2, roles: [], memberships: [] };

	beforeAll(async () => {
		const { freshDatabase, migrateWithRetry } = await import('./db/test-db.ts');
		process.env.DATABASE_URL = await freshDatabase(url as string, 'mediathek');
		process.env.APP_DATABASE_PASSWORD ??= 'test-app-passwort';
		process.env.ENCRYPTION_KEY ??= Buffer.alloc(32, 7).toString('base64');
		process.env.FILES_DIR = await mkdtemp(join(tmpdir(), 'mediathek-dateien-'));
		arbeit = await mkdtemp(join(tmpdir(), 'mediathek-arbeit-'));
		process.env.VIDEO_ARBEIT = arbeit;
		db = (await import('./db/index.ts')).db;
		const { runMigrations } = await import('./db/migrate.ts');
		await migrateWithRetry(() => runMigrations());
		m = await import('./mediathek.ts');
		await db.execute(sql`insert into tenants (id, name, short_name, is_main) values
			(${T1}, 'Haus A', 'A', true), (${T2}, 'Haus B', 'B', false)`);
		await db.execute(sql`insert into units (id, tenant_id, type, name, slug, is_central) values
			(${ZENTRAL}, ${T1}, 'abteilung', 'Zentral', 'zentral', true),
			(${EIGEN}, ${T1}, 'hub', 'Eigen', 'eigen', false)`);
		await db.execute(sql`insert into persons (id, tenant_id, email, display_name, auth_source) values
			(${PFLEGE}, ${T1}, 'pflege@example.org', 'Pflege', 'local'),
			(${LESER}, ${T1}, 'leser@example.org', 'Leser', 'local'),
			(${FREMD}, ${T2}, 'fremd@example.org', 'Fremd', 'local')`);
		await db.execute(sql`insert into unit_members (unit_id, person_id, may_write_media) values
			(${ZENTRAL}, ${PFLEGE}, true), (${EIGEN}, ${PFLEGE}, true), (${ZENTRAL}, ${LESER}, false)`);
	});

	/** Video direkt als fertigen Entwurf anlegen (ohne Umwandlung) */
	async function entwurf(unitId: string, tenantIds: string[] | null = null) {
		const id = await m.videoAnlegen(pflege, { unitId, title: 'Test', size: 100 });
		await db.execute(sql`update videos set status = 'entwurf', duration_sec = 120,
			tenant_ids = ${tenantIds ? sql`${`{${tenantIds.join(',')}}`}::uuid[]` : sql`null`} where id = ${id}`);
		return id;
	}

	it('ohne Recht „Mediathek“ kein Hochladen', async () => {
		await expect(m.videoAnlegen(leser, { unitId: ZENTRAL, title: 'X', size: 10 })).rejects.toThrow(
			/Recht/
		);
		await expect(m.videoAnlegen(fremd, { unitId: EIGEN, title: 'X', size: 10 })).rejects.toThrow(
			/Recht/
		);
		await expect(
			m.videoAnlegen(pflege, { unitId: ZENTRAL, title: 'X', size: 5 * 1024 ** 3 })
		).rejects.toThrow(/4 GB/);
	});

	it('Entwürfe sehen nur Personen mit dem Recht', async () => {
		const id = await entwurf(ZENTRAL);
		expect(await m.videoDetail(pflege, id)).not.toBeNull();
		expect(await m.videoDetail(leser, id)).toBeNull();
		expect((await m.videosListe(leser, {})).some((v) => v.id === id)).toBe(false);
		await expect(
			m.metaSpeichern(leser, id, { title: 'Y', description: '', themen: [], tenantIds: null })
		).rejects.toThrow(/Recht/);
		await m.untertitelSetzen(pflege, id, VTT);
		await m.veroeffentlichen(pflege, id, true);
		expect(await m.videoDetail(leser, id)).not.toBeNull();
		expect((await m.videosListe(leser, {})).some((v) => v.id === id)).toBe(true);
		// Zentrale Einheit: auch der andere Mandant sieht es
		expect(await m.videoDetail(fremd, id)).not.toBeNull();
	});

	it('Mandanten-Einschränkung und eigene Einheiten greifen auch in der Datenbank (RLS)', async () => {
		const nurA = await entwurf(ZENTRAL, [T1]);
		await m.untertitelSetzen(pflege, nurA, VTT);
		await m.veroeffentlichen(pflege, nurA, true);
		const lokal = await entwurf(EIGEN);
		await m.untertitelSetzen(pflege, lokal, VTT);
		await m.veroeffentlichen(pflege, lokal, true);
		expect(await m.videoDetail(leser, nurA)).not.toBeNull();
		expect(await m.videoDetail(fremd, nurA)).toBeNull();
		expect(await m.videoDetail(fremd, lokal)).toBeNull();
		const { scoped } = await import('./db/index.ts');
		const { videos } = await import('./db/schema.ts');
		const sichtbar = await scoped(fremd, (tx) => tx.select({ id: videos.id }).from(videos));
		expect(sichtbar.map((r) => r.id)).not.toContain(nurA);
		expect(sichtbar.map((r) => r.id)).not.toContain(lokal);
	});

	it('Mandanten wählen nur zentrale Einheiten', async () => {
		const lokal = await entwurf(EIGEN);
		await m.metaSpeichern(pflege, lokal, {
			title: 'Lokal',
			description: '',
			themen: [],
			tenantIds: [T2]
		});
		const [r] = (await db.execute(
			sql`select tenant_ids from videos where id = ${lokal}`
		)) as unknown as {
			tenant_ids: string[] | null;
		}[];
		expect(r.tenant_ids).toBeNull();
	});

	it('Veröffentlichen braucht Untertitel; Entfernen zieht zurück', async () => {
		const id = await entwurf(ZENTRAL);
		await expect(m.veroeffentlichen(pflege, id, true)).rejects.toThrow(/Untertitel/);
		await m.untertitelSetzen(pflege, id, VTT);
		await m.veroeffentlichen(pflege, id, true);
		await m.untertitelSetzen(pflege, id, null);
		const v = await m.videoDetail(pflege, id);
		expect(v?.status).toBe('entwurf');
	});

	it('Untertitel werden zu reinem Text bereinigt', () => {
		const { vtt, text } = m.vttBereinigen(VTT);
		expect(vtt).not.toMatch(/<|script/);
		expect(text).toBe('Hallo xWelt Zweite Zeile');
		const pfeil = m.vttBereinigen('WEBVTT\n\n00:00.000 --> 00:01.000\na --> b <<script>>c --!>\n');
		expect(pfeil.vtt.split('\n').slice(2)).toEqual(['00:00.000 --> 00:01.000', 'a -- b c --!', '']);
		expect(() => m.vttBereinigen('1\n00:00:01,000 --> 00:00:02,000\nSRT')).toThrow(/WebVTT/);
		expect(() => m.vttBereinigen('WEBVTT\n\nnur Text')).toThrow(/keine Untertitel/);
	});

	it('Kapitel werden geprüft', async () => {
		const id = await entwurf(ZENTRAL);
		await m.kapitelSetzen(pflege, id, [
			{ s: 0, t: 'Start' },
			{ s: 60, t: 'Mitte' }
		]);
		await expect(m.kapitelSetzen(pflege, id, [{ s: 5, t: 'Spät' }])).rejects.toThrow(/0:00/);
		await expect(
			m.kapitelSetzen(pflege, id, [
				{ s: 0, t: 'A' },
				{ s: 500, t: 'Nach dem Ende' }
			])
		).rejects.toThrow(/Ende/);
	});

	it('Teile kommen der Reihe nach und nur als Video', async () => {
		const id = await m.videoAnlegen(pflege, { unitId: EIGEN, title: 'Upload', size: 32 });
		const kopf = new Uint8Array(16);
		kopf.set(Buffer.from('ftypisom', 'latin1'), 4);
		await expect(m.teilAnhaengen(pflege, id, 0, new Uint8Array(16))).rejects.toThrow(
			/keine Videodatei/
		);
		await expect(m.teilAnhaengen(pflege, id, 16, kopf)).rejects.toThrow(/Falscher Teil/);
		await expect(m.teilAnhaengen(leser, id, 0, kopf)).rejects.toThrow(/Recht/);
		expect(await m.teilAnhaengen(pflege, id, 0, kopf)).toEqual({ erhalten: 16, fertig: false });
		await expect(m.teilAnhaengen(pflege, id, 16, new Uint8Array(17))).rejects.toThrow(/Mehr Daten/);
		expect(await m.teilAnhaengen(pflege, id, 16, new Uint8Array(16))).toEqual({
			erhalten: 32,
			fertig: true
		});
		expect(await readdir(join(arbeit, id))).toContain('auftrag');
		await m.videoLoeschen(pflege, id);
	});

	it('höchstens drei Videos gleichzeitig in Arbeit', async () => {
		await db.execute(sql`delete from videos where status in ('hochladen', 'warten', 'umwandeln')`);
		for (let i = 0; i < 3; i++)
			await m.videoAnlegen(pflege, { unitId: EIGEN, title: `V${i}`, size: 10 });
		await expect(m.videoAnlegen(pflege, { unitId: EIGEN, title: 'V4', size: 10 })).rejects.toThrow(
			/3 Videos/
		);
		await db.execute(sql`delete from videos where status = 'hochladen'`);
	});

	it('Obergrenze verhindert neue Uploads', async () => {
		await m.grenzeSetzen(1, PFLEGE);
		await expect(
			m.videoAnlegen(pflege, { unitId: EIGEN, title: 'Groß', size: 2 * 1024 ** 3 })
		).rejects.toThrow(/voll/);
		await m.grenzeSetzen(500, PFLEGE);
	});

	it.skipIf(!ffmpeg)(
		'wandelt um, lagert verschlüsselt ein, liefert nur nach Rechteprüfung aus und löscht',
		async () => {
			const quelle = join(arbeit, 'quelle.mp4');
			execFileSync('ffmpeg', [
				'-v',
				'error',
				'-f',
				'lavfi',
				'-i',
				'testsrc=size=640x360:rate=25',
				'-f',
				'lavfi',
				'-i',
				'sine=frequency=440',
				'-t',
				'3',
				'-metadata',
				'title=Geheim',
				'-c:v',
				'libx264',
				'-pix_fmt',
				'yuv420p',
				'-c:a',
				'aac',
				'-shortest',
				quelle
			]);
			const inhalt = readFileSync(quelle);
			const id = await m.videoAnlegen(pflege, {
				unitId: ZENTRAL,
				title: 'Echt',
				size: inhalt.length
			});
			for (let o = 0; o < inhalt.length; o += 1024 * 1024)
				await m.teilAnhaengen(pflege, id, o, inhalt.subarray(o, o + 1024 * 1024));
			const r = spawnSync('sh', [resolve('video/umwandeln.sh')], {
				env: { ...process.env, ARBEIT: arbeit, EINMAL: '1' },
				encoding: 'utf8'
			});
			expect(r.status, r.stderr).toBe(0);
			await m.umwandlungAbholen();
			const v = await m.videoDetail(pflege, id);
			expect(v?.status).toBe('entwurf');
			expect(v?.durationSec).toBe(3);
			expect(v?.heights).toEqual([360]);
			const master = await m.medium(pflege, id, 'master.m3u8');
			expect(master?.mime).toBe('application/vnd.apple.mpegurl');
			expect(Buffer.from(master!.data).toString()).toContain('#EXTM3U');
			// Unveröffentlicht: andere bekommen nichts; Pfade außerhalb werden abgelehnt
			expect(await m.medium(leser, id, 'master.m3u8')).toBeNull();
			expect(await m.medium(pflege, id, '../master.m3u8')).toBeNull();
			// Metadaten des Originals sind entfernt
			const init = await m.medium(pflege, id, '360/init.mp4');
			expect(Buffer.from(init!.data).includes(Buffer.from('Geheim'))).toBe(false);
			// Verschlüsselt abgelegt
			const roh = await readdir(join(process.env.FILES_DIR as string, 'videos', id));
			expect(roh).toContain('master.m3u8');
			await m.videoLoeschen(pflege, id);
			await expect(readdir(join(process.env.FILES_DIR as string, 'videos', id))).rejects.toThrow();
		},
		60_000
	);

	it('Fehler der Umwandlung landen am Video', async () => {
		const id = await m.videoAnlegen(pflege, { unitId: EIGEN, title: 'Kaputt', size: 10 });
		await db.execute(sql`update videos set status = 'umwandeln' where id = ${id}`);
		await writeFile(join(arbeit, id, 'fehler'), 'Das ist keine Videodatei.\n');
		await m.umwandlungAbholen();
		const [r] = (await db.execute(
			sql`select status, error_message from videos where id = ${id}`
		)) as unknown as {
			status: string;
			error_message: string;
		}[];
		expect(r.status).toBe('fehler');
		expect(r.error_message).toContain('keine Videodatei');
	});

	it('Fortschritt: nur die eigene Person, gelöscht am Ende, beim Ausschalten und nach 90 Tagen', async () => {
		const f = await import('./fortschritt.ts');
		const id = await entwurf(ZENTRAL);
		await m.untertitelSetzen(pflege, id, VTT);
		await m.veroeffentlichen(pflege, id, true);
		// Ganz am Anfang nichts merken, mitten drin schon
		expect(await f.merken(leser, id, 3)).toBe(true);
		expect(await f.position(leser, id)).toBeNull();
		await f.merken(leser, id, 42.7);
		expect(await f.position(leser, id)).toBe(42);
		expect((await f.weiterAnsehen(leser)).map((w) => w.id)).toContain(id);
		// Andere sehen den Stand nicht, auch nicht über die Datenbank (RLS)
		expect(await f.position(pflege, id)).toBeNull();
		const { scoped } = await import('./db/index.ts');
		const { videoProgress } = await import('./db/schema.ts');
		expect(await scoped(pflege, (tx) => tx.select().from(videoProgress))).toEqual([]);
		await expect(
			scoped(pflege, (tx) =>
				tx.insert(videoProgress).values({ personId: LESER, videoId: id, positionSec: 9 })
			)
		).rejects.toThrow();
		// Kurz vor dem Ende gilt als gesehen (120 s: letzte 12 s)
		await f.merken(leser, id, 107);
		expect(await f.position(leser, id)).toBe(107);
		await f.merken(leser, id, 109);
		expect(await f.position(leser, id)).toBeNull();
		// Entwürfe ohne Recht: nichts merken
		const geheim = await entwurf(ZENTRAL);
		expect(await f.merken(leser, geheim, 30)).toBe(false);
		// Ausschalten löscht und verhindert weiteres Merken
		await f.merken(leser, id, 30);
		await f.fortschrittSchalten(leser, false);
		expect(await f.position(leser, id)).toBeNull();
		expect(await f.merken(leser, id, 30)).toBe(false);
		await f.fortschrittSchalten(leser, true);
		// Nach 90 Tagen weg
		await f.merken(leser, id, 30);
		await db.execute(sql`update video_progress set updated_at = now() - interval '91 days'`);
		await f.alterFortschrittLoeschen();
		expect(await f.position(leser, id)).toBeNull();
		// Kein Eintrag im Protokoll
		const [{ n }] = (await db.execute(
			sql`select count(*)::int as n from audit_log where entity_id = ${id}`
		)) as unknown as { n: number }[];
		expect(n).toBe(0);
	});
});
