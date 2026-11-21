/**
 * Bildbeschreibungen: nur für Bilder und nur für die übergebenen Dateien.
 * Läuft nur mit TEST_DATABASE_URL; eigene Datenbank <name>_beschreibung.
 */
import { sql } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import { bildAlt } from '../../bildbeschreibung.ts';

const url = process.env.TEST_DATABASE_URL;
const BILD = '00000000-0000-0000-0000-00000000f001';
const PDF = '00000000-0000-0000-0000-00000000f002';
const FREMD = '00000000-0000-0000-0000-00000000f003';

describe('Bildbeschreibungen', () => {
	it('Alternativtext: eigene Beschreibung, sonst allgemeiner Text', () => {
		expect(bildAlt('  Chor auf der Probebühne ', 'Foto 1')).toBe('Chor auf der Probebühne');
		expect(bildAlt('', 'Foto 1')).toBe('Foto 1');
		expect(bildAlt(null, 'Foto 1')).toBe('Foto 1');
	});
});

describe.skipIf(!url)('Bildbeschreibungen speichern', () => {
	let db: typeof import('../db/index.ts').db;
	let b: typeof import('./beschreibung.ts');

	const beschreibung = async (id: string) =>
		(
			await db.execute<{ d: string | null }>(
				sql`select description as d from files where id = ${id}`
			)
		)[0].d;

	beforeAll(async () => {
		const { freshDatabase, migrateWithRetry } = await import('../db/test-db.ts');
		process.env.DATABASE_URL = await freshDatabase(url as string, 'beschreibung');
		process.env.APP_DATABASE_PASSWORD ??= 'test-app-passwort';
		db = (await import('../db/index.ts')).db;
		const { runMigrations } = await import('../db/migrate.ts');
		await migrateWithRetry(() => runMigrations());
		b = await import('./beschreibung.ts');
		await db.execute(sql`
			insert into files (id, name, mime, kind, size, key_enc) values
				(${BILD}, 'probe.jpg', 'image/jpeg', 'jpeg', 1, 'x'),
				(${PDF}, 'plan.pdf', 'application/pdf', 'pdf', 1, 'x'),
				(${FREMD}, 'fremd.png', 'image/png', 'png', 1, 'x')`);
	});

	it('liest Felder aus dem Formular, kürzt und entfernt Zeilenumbrüche', () => {
		const f = new FormData();
		f.set(`beschreibung_${BILD}`, '  Chor\nauf der  Bühne ');
		f.set('beschreibung_kaputt', 'x');
		f.set(`beschreibung_${PDF}`, 'y'.repeat(400));
		const m = b.beschreibungenAusForm(f);
		expect(m.get(BILD)).toBe('Chor auf der Bühne');
		expect(m.get(PDF)).toHaveLength(250);
		expect(m.size).toBe(2);
	});

	it('speichert nur für Bilder aus der Liste', async () => {
		const m = new Map([
			[BILD, 'Chor auf der Bühne'],
			[PDF, 'Plan'],
			[FREMD, 'Fremdes Bild']
		]);
		await b.beschreibungenSpeichern(db, [BILD, PDF], m);
		expect(await beschreibung(BILD)).toBe('Chor auf der Bühne');
		expect(await beschreibung(PDF)).toBeNull();
		expect(await beschreibung(FREMD)).toBeNull();
		// Leeres Feld entfernt die Beschreibung
		await b.beschreibungenSpeichern(db, [BILD], new Map([[BILD, '']]));
		expect(await beschreibung(BILD)).toBeNull();
	});

	it('übernimmt Eingaben beim erneuten Anzeigen', () => {
		const liste = [{ id: BILD, name: 'probe.jpg', description: 'alt' }];
		expect(b.mitBeschreibungen(liste, new Map([[BILD, 'neu']]))[0].description).toBe('neu');
		expect(b.mitBeschreibungen(liste, new Map())[0].description).toBe('alt');
	});
});
