/**
 * Mediathek (Kap. 8.15): Vorschlag für Zusammenfassung und Kapitel. Prüft
 * Eingabe, Lesen der Modell-Antwort (nicht vertrauenswürdig), Anfordern nur
 * mit geprüften Untertiteln, Abholen und Übernehmen. Läuft nur mit TEST_DATABASE_URL.
 */
import { existsSync, readFileSync } from 'node:fs';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sql } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Membership, Principal } from './auth/access.ts';

const url = process.env.TEST_DATABASE_URL;
const T1 = '00000000-0000-0000-0000-000000000001';
const EINHEIT = '00000000-0000-0000-0000-0000000000a1';
const PFLEGE = '00000000-0000-0000-0000-0000000000b1';
const LESER = '00000000-0000-0000-0000-0000000000b2';

const mitglied = (media: boolean): Membership => ({
	unitId: EINHEIT,
	isPrimary: false,
	mayWriteNews: false,
	mayWriteFaqs: false,
	mayWriteEvents: false,
	mayWriteBehindScenes: false,
	mayWriteMedia: media
});

const VTT = `WEBVTT

00:00:00.000 --> 00:00:05.000
Willkommen zur Einführung in die Zeiterfassung.

00:01:10.000 --> 00:01:15.000
So meldest du dich am Terminal an.

00:02:30.000 --> 00:02:35.000
Pausen buchst du über die Taste Pause.
`;

describe.skipIf(!url)('Vorschlag für Zusammenfassung und Kapitel', () => {
	let db: typeof import('./db/index.ts').db;
	let m: typeof import('./mediathek.ts');
	let vs: typeof import('./video-vorschlag.ts');
	const pflege: Principal = {
		personId: PFLEGE,
		tenantId: T1,
		roles: [],
		memberships: [mitglied(true)]
	};
	const leser: Principal = {
		personId: LESER,
		tenantId: T1,
		roles: [],
		memberships: [mitglied(false)]
	};

	beforeAll(async () => {
		const { freshDatabase, migrateWithRetry } = await import('./db/test-db.ts');
		process.env.DATABASE_URL = await freshDatabase(url as string, 'vorschlag');
		process.env.APP_DATABASE_PASSWORD ??= 'test-app-passwort';
		process.env.ENCRYPTION_KEY ??= Buffer.alloc(32, 7).toString('base64');
		process.env.FILES_DIR = await mkdtemp(join(tmpdir(), 'vorschlag-dateien-'));
		process.env.VIDEO_ARBEIT = await mkdtemp(join(tmpdir(), 'vorschlag-arbeit-'));
		db = (await import('./db/index.ts')).db;
		const { runMigrations } = await import('./db/migrate.ts');
		await migrateWithRetry(() => runMigrations());
		m = await import('./mediathek.ts');
		vs = await import('./video-vorschlag.ts');
		await db.execute(sql`insert into tenants (id, name, short_name, is_main) values
			(${T1}, 'Haus A', 'A', true)`);
		await db.execute(sql`insert into units (id, tenant_id, type, name, slug) values
			(${EINHEIT}, ${T1}, 'hub', 'Einheit', 'einheit')`);
		await db.execute(sql`insert into persons (id, tenant_id, email, display_name, auth_source) values
			(${PFLEGE}, ${T1}, 'pflege@example.org', 'Pflege', 'local'),
			(${LESER}, ${T1}, 'leser@example.org', 'Leser', 'local')`);
		await db.execute(sql`insert into unit_members (unit_id, person_id, may_write_media) values
			(${EINHEIT}, ${PFLEGE}, true), (${EINHEIT}, ${LESER}, false)`);
	});

	async function entwurf() {
		const id = await m.videoAnlegen(pflege, { unitId: EINHEIT, title: 'Schulung', size: 100 });
		await db.execute(
			sql`update videos set status = 'entwurf', duration_sec = 300 where id = ${id}`
		);
		return id;
	}
	const daten = (id: string) => m.bearbeitenDaten(pflege, id);

	it('baut die Eingabe aus den Untertiteln mit Zeitmarken und kürzt lange Fassungen', () => {
		expect(vs.vorschlagEingabe(VTT).split('\n')).toEqual([
			'[0:00] Willkommen zur Einführung in die Zeiterfassung.',
			'[1:10] So meldest du dich am Terminal an.',
			'[2:30] Pausen buchst du über die Taste Pause.'
		]);
		const lang = [
			'WEBVTT',
			'',
			...Array.from({ length: 3000 }, (_, i) => [
				`00:${String(Math.floor(i / 60) % 60).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}.000 --> 00:00:59.000`,
				'Ein ziemlich langer Satz, der immer wieder vorkommt.',
				''
			]).flat()
		].join('\n');
		expect(vs.vorschlagEingabe(lang).length).toBeLessThanOrEqual(vs.MAX_EINGABE);
	});

	it('liest die Antwort des Modells streng', () => {
		const ok = vs.vorschlagLesen(
			`Text davor {"zusammenfassung": "Du lernst die <b>Zeiterfassung</b>.",
			"kapitel": [{"start": "1:10", "titel": "Anmelden"}, {"start": "0:05", "titel": "Start"},
			{"start": "1:10", "titel": "Doppelt"}, {"start": "9:00", "titel": "Nach dem Ende"},
			{"start": "quatsch", "titel": "Ohne Zeit"}, {"start": "2:30", "titel": ""}]} danach`,
			300
		);
		expect(ok).toEqual({
			zusammenfassung: 'Du lernst die Zeiterfassung.',
			kapitel: [
				{ s: 0, t: 'Start' },
				{ s: 70, t: 'Anmelden' }
			]
		});
		// Nur ein Kapitel ist keine Gliederung
		expect(
			vs.vorschlagLesen(
				'{"zusammenfassung": "Kurz.", "kapitel": [{"start": "0:00", "titel": "A"}]}',
				300
			)
		).toEqual({ zusammenfassung: 'Kurz.', kapitel: [] });
		expect(vs.vorschlagLesen('kein JSON', 300)).toBeNull();
		expect(vs.vorschlagLesen('{"zusammenfassung": "", "kapitel": []}', 300)).toBeNull();
	});

	it('anfordern nur mit Recht und geprüften Untertiteln', async () => {
		const id = await entwurf();
		await expect(vs.vorschlagAnfordern(pflege, id)).rejects.toThrow(/Untertitel/);
		await db.execute(sql`update videos set captions_vtt = ${VTT}, captions_source = 'automatisch'
			where id = ${id}`);
		await expect(vs.vorschlagAnfordern(pflege, id)).rejects.toThrow(/Prüfe zuerst/);
		await m.untertitelPruefen(pflege, id, true);
		await expect(vs.vorschlagAnfordern(leser, id)).rejects.toThrow(/Recht/);
		await vs.vorschlagAnfordern(pflege, id);
		expect((await daten(id)).suggestionStatus).toBe('warten');
		const eingabe = readFileSync(join(vs.vorschlagOrdner(id), 'eingabe.txt'), 'utf8');
		expect(eingabe).toContain('[1:10] So meldest du dich am Terminal an.');
		expect(existsSync(join(vs.vorschlagOrdner(id), 'auftrag'))).toBe(true);
		await expect(vs.vorschlagAnfordern(pflege, id)).rejects.toThrow(/schon/);
	});

	it('Ergebnis abholen, Teile übernehmen, Vorhandenes erst auf Klick ersetzen', async () => {
		const id = await entwurf();
		await db.execute(sql`update videos set captions_vtt = ${VTT}, captions_source = 'hochgeladen',
			description = 'Alt' where id = ${id}`);
		await vs.vorschlagAnfordern(pflege, id);
		await writeFile(
			join(vs.vorschlagOrdner(id), 'ergebnis.json'),
			JSON.stringify({
				zusammenfassung: 'Du lernst, wie die Zeiterfassung funktioniert.',
				kapitel: [
					{ start: '0:00', titel: 'Einführung' },
					{ start: '1:10', titel: 'Anmelden' },
					{ start: '2:30', titel: 'Pausen' }
				]
			})
		);
		await vs.vorschlaegeAbholen();
		let d = await daten(id);
		expect(d.suggestionStatus).toBe('fertig');
		expect(d.description).toBe('Alt');
		expect(existsSync(vs.vorschlagOrdner(id))).toBe(false);
		const [nachricht] = (await db.execute(sql`select title from notifications
			where person_id = ${PFLEGE} order by created_at desc limit 1`)) as unknown as {
			title: string;
		}[];
		expect(nachricht?.title).toMatch(/Vorschlag für „Schulung“ ist fertig/);

		await vs.vorschlagUebernehmen(pflege, id, 'zusammenfassung');
		d = await daten(id);
		expect(d.description).toBe('Du lernst, wie die Zeiterfassung funktioniert.');
		expect(d.suggestionStatus).toBe('fertig');
		await expect(vs.vorschlagUebernehmen(pflege, id, 'zusammenfassung')).rejects.toThrow(
			/keine Zusammenfassung/
		);
		await vs.vorschlagUebernehmen(pflege, id, 'kapitel');
		d = await daten(id);
		expect(d.chapters).toEqual([
			{ s: 0, t: 'Einführung' },
			{ s: 70, t: 'Anmelden' },
			{ s: 150, t: 'Pausen' }
		]);
		expect(d.suggestionStatus).toBeNull();
		expect(d.suggestion).toBeNull();
	});

	it('Fehler und Verwerfen', async () => {
		const id = await entwurf();
		await db.execute(sql`update videos set captions_vtt = ${VTT}, captions_source = 'hochgeladen'
			where id = ${id}`);
		await vs.vorschlagAnfordern(pflege, id);
		await writeFile(join(vs.vorschlagOrdner(id), 'ergebnis.json'), '{"unsinn": true}');
		await vs.vorschlaegeAbholen();
		let d = await daten(id);
		expect(d.suggestionStatus).toBe('fehler');
		expect(d.suggestionError).toMatch(/kein Vorschlag/);

		await vs.vorschlagAnfordern(pflege, id);
		await vs.vorschlagVerwerfen(pflege, id);
		d = await daten(id);
		expect(d.suggestionStatus).toBeNull();
		expect(existsSync(vs.vorschlagOrdner(id))).toBe(false);
		// Ein spätes Ergebnis nach dem Verwerfen wird nicht übernommen
		await vs.vorschlaegeAbholen();
		expect((await daten(id)).suggestionStatus).toBeNull();
	});

	it('Vorschlag beim Hochladen: gewählt gespeichert, Ergebnis als „ungeprüft“ gekennzeichnet', async () => {
		const id = await m.videoAnlegen(pflege, {
			unitId: EINHEIT,
			title: 'Upload',
			size: 100,
			vorschlag: true
		});
		const [r] = (await db.execute(
			sql`select suggest_on_upload from videos where id = ${id}`
		)) as unknown as { suggest_on_upload: boolean }[];
		expect(r.suggest_on_upload).toBe(true);
		await db.execute(sql`update videos set status = 'entwurf', duration_sec = 300,
			captions_vtt = ${VTT}, captions_source = 'automatisch' where id = ${id}`);
		expect(await vs.vorschlagStarten(id, PFLEGE, VTT, true)).toBe(true);
		expect(
			await vs.vorschlagStarten(id, PFLEGE, 'WEBVTT\n\n00:00.000 --> 00:01.000\nKurz\n', true)
		).toBe(false);
		await writeFile(
			join(vs.vorschlagOrdner(id), 'ergebnis.json'),
			'{"zusammenfassung": "Du lernst die Zeiterfassung.", "kapitel": []}'
		);
		await vs.vorschlaegeAbholen();
		const d = await daten(id);
		expect(d.suggestionStatus).toBe('fertig');
		expect(d.suggestion).toEqual({
			zusammenfassung: 'Du lernst die Zeiterfassung.',
			kapitel: [],
			ungeprueft: true
		});
		// Neu anfordern geht erst mit geprüften Untertiteln
		await expect(vs.vorschlagAnfordern(pflege, id)).rejects.toThrow(/Prüfe zuerst/);
	});
});
