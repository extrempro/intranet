/**
 * Bilder im Text: nur eigene, noch freie Bilder oder schon verknüpfte; nach
 * dem Entfernen aus dem Text wird die Datei frei (Aufräumen nach 24 h).
 * Läuft nur mit TEST_DATABASE_URL; eigene Datenbank <name>_textbilder.
 */
import { sql } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Principal } from './auth/access.ts';

const url = process.env.TEST_DATABASE_URL;
const T = '00000000-0000-0000-0000-000000000001';
const U = '00000000-0000-0000-0000-0000000000a1';
const ICH = '00000000-0000-0000-0000-0000000000b1';
const ANDERE = '00000000-0000-0000-0000-0000000000b2';
const FAQ = '00000000-0000-0000-0000-0000000000c1';
const BILD1 = '00000000-0000-4000-8000-00000000f001';
const BILD2 = '00000000-0000-4000-8000-00000000f002';
const FREMD = '00000000-0000-4000-8000-00000000f003';
const PDF = '00000000-0000-4000-8000-00000000f004';

const img = (id: string, alt = 'Bild') =>
	`<img src="/dateien/${id}" alt="${alt}" class="bild-voll">`;

describe.skipIf(!url)('Bilder im Text', () => {
	let db: typeof import('./db/index.ts').db;
	let tb: typeof import('./textbilder.ts');
	const ich: Principal = { personId: ICH, tenantId: T, roles: [], memberships: [] };

	beforeAll(async () => {
		const { freshDatabase, migrateWithRetry } = await import('./db/test-db.ts');
		process.env.DATABASE_URL = await freshDatabase(url as string, 'textbilder');
		process.env.APP_DATABASE_PASSWORD ??= 'test-app-passwort';
		db = (await import('./db/index.ts')).db;
		const { runMigrations } = await import('./db/migrate.ts');
		await migrateWithRetry(() => runMigrations());
		tb = await import('./textbilder.ts');
		await db.execute(
			sql`insert into tenants (id, name, short_name, is_main) values (${T}, 'Haus A', 'BH', true)`
		);
		await db.execute(sql`
			insert into units (id, tenant_id, type, name, slug, is_central) values (${U}, ${T}, 'abteilung', 'IT', 'it', true)`);
		await db.execute(sql`
			insert into persons (id, tenant_id, email, display_name, auth_source) values
				(${ICH}, ${T}, 'ich@haus-a.example', 'Ich', 'local'), (${ANDERE}, ${T}, 'du@haus-a.example', 'Du', 'local')`);
		await db.execute(sql`
			insert into faqs (id, unit_id, question, answer_html, answer_text) values (${FAQ}, ${U}, 'Frage?', '', '')`);
		await db.execute(sql`
			insert into files (id, name, mime, kind, size, key_enc, created_by) values
				(${BILD1}, 'a.webp', 'image/webp', 'webp', 1000, 'x', ${ICH}),
				(${BILD2}, 'b.jpg', 'image/jpeg', 'jpeg', 1000, 'x', ${ICH}),
				(${FREMD}, 'c.webp', 'image/webp', 'webp', 1000, 'x', ${ANDERE}),
				(${PDF}, 'd.pdf', 'application/pdf', 'pdf', 1000, 'x', ${ICH})`);
	});

	it('lässt nur eigene, freie Bilder zu; fremde und PDFs fallen weg', async () => {
		const r = await tb.textMitBildern(ich, `<p>Text</p>${img(BILD1)}${img(FREMD)}${img(PDF)}`, {
			art: 'faq',
			id: FAQ
		});
		expect(r.fehler).toBeUndefined();
		expect(r.bilder).toEqual([BILD1]);
		expect(r.html).not.toContain(FREMD);
	});

	it('verlangt eine Beschreibung für jedes Bild', async () => {
		const r = await tb.textMitBildern(ich, img(BILD1, ''), { art: 'faq', id: FAQ });
		expect(r.fehler).toMatch(/beschreibe/);
	});

	it('verknüpft und gibt entfernte Bilder wieder frei', async () => {
		await db.transaction((tx) => tb.bilderVerknuepfen(tx, { art: 'faq', id: FAQ }, [BILD1, BILD2]));
		// Verknüpft: bleibt beim erneuten Speichern erlaubt, gilt nicht mehr als frei
		const wieder = await tb.textMitBildern(ich, `${img(BILD1)}${img(BILD2)}`, {
			art: 'faq',
			id: FAQ
		});
		expect(wieder.bilder).toEqual([BILD1, BILD2]);
		const { ownUnlinkedFiles } = await import('./files/store.ts');
		expect(await ownUnlinkedFiles(ICH, [BILD1, BILD2])).toEqual([]);
		// Für einen anderen Beitrag nicht nutzbar
		const anders = await tb.textMitBildern(ich, img(BILD1), { art: 'faq', id: null });
		expect(anders.bilder).toEqual([]);
		// Aus dem Text entfernt: frei für das Aufräumen
		await db.transaction((tx) => tb.bilderVerknuepfen(tx, { art: 'faq', id: FAQ }, [BILD1]));
		expect(await ownUnlinkedFiles(ICH, [BILD2])).toEqual([BILD2]);
	});
});
