/**
 * Teams-Benachrichtigungen mit echter Datenbank und gespieltem Graph.
 * Läuft nur mit TEST_DATABASE_URL; eigene Datenbank <name>_teams.
 */
import { sql } from 'drizzle-orm';
import { beforeAll, describe, expect, it, vi } from 'vitest';

// Kein echter Aufruf bei Microsoft: Der Sofortversand nach notify() läuft im
// Hintergrund und würde sonst je nach Netz unterschiedlich lange dauern.
vi.mock('./auth/entra.ts', async (original) => ({
	...(await original<typeof import('./auth/entra.ts')>()),
	graphAppPost: async () => {
		throw new Error('Im Test kein Aufruf bei Microsoft');
	}
}));

const url = process.env.TEST_DATABASE_URL;
const T = '00000000-0000-0000-0000-000000000001';
const P = {
	entra: '00000000-0000-0000-0000-0000000000d1',
	entraRuhe: '00000000-0000-0000-0000-0000000000d2',
	entraAus: '00000000-0000-0000-0000-0000000000d3',
	lokal: '00000000-0000-0000-0000-0000000000d4'
};
const calls: {
	path: string;
	body: { recipients: { userId: string }[]; previewText: { content: string } };
}[] = [];
const post = async (path: string, body: unknown) => {
	calls.push({ path, body: body as (typeof calls)[number]['body'] });
};

/** Wartet, bis kein Versand im Hintergrund mehr läuft. */
async function idle() {
	const { teamsBusy } = await import('./teams.ts');
	for (let i = 0; i < 100 && teamsBusy(); i++) await new Promise((r) => setTimeout(r, 50));
	// Einen Moment für einen eben angestoßenen Lauf
	await new Promise((r) => setTimeout(r, 50));
	for (let i = 0; i < 100 && teamsBusy(); i++) await new Promise((r) => setTimeout(r, 50));
}

describe.skipIf(!url)('Teams-Benachrichtigungen', () => {
	let db: typeof import('./db/index.ts').db;
	let notify: typeof import('./notify.ts');
	let teams: typeof import('./teams.ts');

	beforeAll(async () => {
		const { freshDatabase, migrateWithRetry } = await import('./db/test-db.ts');
		process.env.DATABASE_URL = await freshDatabase(url as string, 'teams');
		process.env.APP_DATABASE_PASSWORD ??= 'test-app-passwort';
		process.env.ENTRA_TENANT_ID = '30000000-0000-0000-0000-000000000001';
		process.env.ENTRA_CLIENT_ID = '30000000-0000-0000-0000-000000000002';
		process.env.ENTRA_CLIENT_SECRET = 'nur-fuer-den-test';
		db = (await import('./db/index.ts')).db;
		const { runMigrations } = await import('./db/migrate.ts');
		await migrateWithRetry(() => runMigrations());
		notify = await import('./notify.ts');
		teams = await import('./teams.ts');
		await db.execute(
			sql`insert into tenants (id, name, short_name, is_main) values (${T}, 'Oper', 'BH', true)`
		);
		await db.execute(sql`
			insert into persons (id, tenant_id, email, display_name, auth_source, entra_oid) values
				(${P.entra}, ${T}, 'a@oper.test', 'Anna', 'entra', 'oid-a'),
				(${P.entraRuhe}, ${T}, 'b@oper.test', 'Ben', 'entra', 'oid-b'),
				(${P.entraAus}, ${T}, 'c@oper.test', 'Cem', 'entra', 'oid-c'),
				(${P.lokal}, ${T}, 'd@oper.test', 'Dora', 'local', null)`);
		// Ben: Ruhezeit rund um die Uhr, dringend nicht sofort; Cem: Teams aus
		await db.execute(sql`
			insert into person_preferences (person_id, notify) values
				(${P.entraRuhe}, ${JSON.stringify({ topics: {}, emailMode: 'sofort', quiet: { on: true, start: '00:00', end: '23:59', weekend: true, urgent: false } })}::jsonb),
				(${P.entraAus}, ${JSON.stringify({ topics: { dringend: { teams: false } }, emailMode: 'sofort' })}::jsonb)`);
	});

	it('legt nichts an, solange Teams aus ist', async () => {
		await notify.notify('dringend', [P.entra], { title: 'Vorher', detail: 'IT', link: '/x' });
		const [r] = await db.execute<{ n: number }>(
			sql`select count(*)::int as n from notifications where teams is not null`
		);
		expect(r.n).toBe(0);
	});

	it('nur Microsoft-Konten mit Teams an; Ruhezeit verschiebt', async () => {
		const { teamsSettings, saveTeamsSettings } = await import('./teams-config.ts');
		await saveTeamsSettings({ ...(await teamsSettings()), aktiv: true }, null as unknown as string);
		await notify.notify('dringend', [P.entra, P.entraRuhe, P.entraAus, P.lokal], {
			title: 'WLAN fällt aus',
			detail: 'IT',
			link: '/neuigkeiten/1'
		});
		const rows = await db.execute<{
			person_id: string;
			teams: string | null;
			push_after: Date | null;
		}>(
			sql`select person_id, teams, push_after from notifications where title = 'WLAN fällt aus' order by person_id`
		);
		const by = Object.fromEntries(rows.map((r) => [r.person_id, r]));
		expect(by[P.entra].teams).toBe('pending');
		expect(by[P.entra].push_after).toBeNull();
		expect(by[P.entraRuhe].teams).toBe('pending');
		expect(by[P.entraRuhe].push_after).not.toBeNull();
		expect(by[P.entraAus].teams).toBeNull();
		expect(by[P.lokal].teams).toBeNull();
		// Andere Themen ohne Teams
		await notify.notify('neuigkeiten', [P.entra], { title: 'Normal', link: '/y' });
		const [n] = await db.execute<{ teams: string | null }>(
			sql`select teams from notifications where title = 'Normal'`
		);
		expect(n.teams).toBeNull();
	});

	it('sendet fällige Meldungen gesammelt und markiert sie', async () => {
		// Sofortversand aus notify() abwarten, dann neu auf „offen“ setzen
		await idle();
		await db.execute(
			sql`update notifications set teams = 'pending' where title = 'WLAN fällt aus' and teams is not null`
		);
		calls.length = 0;
		const n = await teams.sendDueTeams(post);
		expect(n).toBe(1);
		expect(calls).toHaveLength(1);
		expect(calls[0].path).toBe('/teamwork/sendActivityNotificationToRecipients');
		expect(calls[0].body.recipients.map((r) => r.userId)).toEqual(['oid-a']);
		expect(calls[0].body.previewText.content).toBe('WLAN fällt aus');
		// Ben bleibt bis zum Ende der Ruhezeit liegen
		const [b] = await db.execute<{ teams: string }>(
			sql`select teams from notifications where person_id = ${P.entraRuhe} and title = 'WLAN fällt aus'`
		);
		expect(b.teams).toBe('pending');
		// Nach der Ruhezeit: zusammengefasst, wenn mehrere offen sind
		await notify.notify('dringend', [P.entraRuhe], { title: 'Zweite', detail: 'IT', link: '/z' });
		await idle();
		await db.execute(
			sql`update notifications set push_after = now() - interval '1 minute' where person_id = ${P.entraRuhe}`
		);
		calls.length = 0;
		await teams.sendDueTeams(post);
		expect(calls[0].body.previewText.content).toBe('2 neue Meldungen im Intranet');
		const [offen] = await db.execute<{ n: number }>(
			sql`select count(*)::int as n from notifications where teams = 'pending'`
		);
		expect(offen.n).toBe(0);
	});

	it('Fehler von Graph: Meldung im Status, nichts bleibt hängen', async () => {
		const { GraphError } = await import('./auth/entra.ts');
		await db.execute(
			sql`insert into notifications (person_id, topic, title, link, teams) values (${P.entra}, 'dringend', 'Kaputt', '/k', 'pending')`
		);
		await teams.sendDueTeams(async () => {
			throw new GraphError(403, 'Graph antwortet mit 403 (Forbidden)');
		});
		const s = await teams.teamsStatus();
		expect(s?.ok).toBe(false);
		expect(s?.meldung).toContain('TeamsActivity.Send');
		const [k] = await db.execute<{ teams: string }>(
			sql`select teams from notifications where title = 'Kaputt'`
		);
		expect(k.teams).toBe('sent');
	});
});
