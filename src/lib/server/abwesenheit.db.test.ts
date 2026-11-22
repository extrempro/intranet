/**
 * Abwesenheit (Kap. 11.3): Push und Teams erst nach der Abwesenheit, Dringendes
 * nach Wahl. Läuft nur mit TEST_DATABASE_URL; eigene Datenbank <name>_abwesenheit.
 */
import { sql } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import { addDays, berlinNow } from '../canteen.ts';
import { berlinMitternacht } from '../notify.ts';

const url = process.env.TEST_DATABASE_URL;
const T = '00000000-0000-0000-0000-000000000001';
const WEG = '00000000-0000-0000-0000-0000000000e1';
const WEG_DRINGEND = '00000000-0000-0000-0000-0000000000e2';
const DA = '00000000-0000-0000-0000-0000000000e3';

describe.skipIf(!url)('Abwesenheit', () => {
	let db: typeof import('./db/index.ts').db;
	let notify: typeof import('./notify.ts');
	const heute = berlinNow().date;
	const bis = addDays(heute, 3);

	beforeAll(async () => {
		const { freshDatabase, migrateWithRetry } = await import('./db/test-db.ts');
		process.env.DATABASE_URL = await freshDatabase(url as string, 'abwesenheit');
		process.env.APP_DATABASE_PASSWORD ??= 'test-app-passwort';
		db = (await import('./db/index.ts')).db;
		const { runMigrations } = await import('./db/migrate.ts');
		await migrateWithRetry(() => runMigrations());
		notify = await import('./notify.ts');
		await db.execute(
			sql`insert into tenants (id, name, short_name, is_main) values (${T}, 'Haus', 'H', true)`
		);
		await db.execute(sql`
			insert into persons (id, tenant_id, email, display_name, auth_source) values
				(${WEG}, ${T}, 'weg@example.org', 'Weg', 'local'),
				(${WEG_DRINGEND}, ${T}, 'wd@example.org', 'Weg Dringend', 'local'),
				(${DA}, ${T}, 'da@example.org', 'Da', 'local')`);
		// Ruhezeiten aus, damit nur die Abwesenheit zählt
		const ohneRuhe = { on: false };
		await notify.setNotify(WEG, {
			topics: {},
			emailMode: 'sofort',
			quiet: ohneRuhe,
			absence: { from: heute, to: bis, urgent: false }
		});
		await notify.setNotify(WEG_DRINGEND, {
			topics: {},
			emailMode: 'sofort',
			quiet: ohneRuhe,
			absence: { from: heute, to: bis, urgent: true }
		});
		await notify.setNotify(DA, { topics: {}, emailMode: 'sofort', quiet: ohneRuhe });
	});

	it('verschiebt Push bis nach der Abwesenheit; Dringendes nach Wahl sofort', async () => {
		await notify.notify('dringend', [WEG, WEG_DRINGEND, DA], { title: 'Ausfall', link: '/x' });
		const rows = await db.execute<{ person_id: string; push_after: Date | null; bell: boolean }>(
			sql`select person_id, push_after, bell from notifications where title = 'Ausfall'`
		);
		const by = Object.fromEntries(rows.map((r) => [r.person_id, r]));
		expect(new Date(by[WEG].push_after as Date).toISOString()).toBe(
			berlinMitternacht(addDays(bis, 1)).toISOString()
		);
		expect(by[WEG].bell).toBe(true);
		expect(by[WEG_DRINGEND].push_after).toBeNull();
		expect(by[DA].push_after).toBeNull();
	});

	it('Einstellungen behalten die Abwesenheit, ungültige fällt weg', async () => {
		expect((await notify.getNotify(WEG)).absence).toEqual({ from: heute, to: bis, urgent: false });
		await notify.setNotify(DA, {
			topics: {},
			emailMode: 'sofort',
			absence: { from: bis, to: heute }
		});
		expect((await notify.getNotify(DA)).absence).toBeNull();
	});
});
