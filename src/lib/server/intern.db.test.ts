/**
 * Interne Inhalte einer Abteilung (Kap. 8.17): Beiträge, Termine und Ordner nur
 * für Mitglieder (alle oder Stammabteilung), Leitung, Stellvertretung und
 * Abteilungsverwaltung; nicht für die Redaktion. Läuft nur mit TEST_DATABASE_URL.
 */
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Principal } from './auth/access.ts';

const url = process.env.TEST_DATABASE_URL;
const T = '00000000-0000-0000-0000-000000000001';
const ABT = '00000000-0000-0000-0000-0000000000a1';
const HUB = '00000000-0000-0000-0000-0000000000a2';
const P = {
	stamm: '00000000-0000-0000-0000-0000000000b1',
	mit: '00000000-0000-0000-0000-0000000000b2',
	leitung: '00000000-0000-0000-0000-0000000000b3',
	verwaltung: '00000000-0000-0000-0000-0000000000b4',
	red: '00000000-0000-0000-0000-0000000000b5',
	fremd: '00000000-0000-0000-0000-0000000000b6'
};
const ORDNER = '00000000-0000-0000-0000-0000000000c1';
const DATEI = '00000000-0000-0000-0000-0000000000c2';

const entwurf = (o: object) => ({
	unitId: ABT,
	title: 'Teambesprechung verschoben',
	bodyHtml: '<p>Text</p>',
	bodyText: 'Text',
	publishAt: new Date(Date.now() - 60_000),
	expiresAt: null,
	pinnedUntil: null,
	urgentUntil: null,
	urgentText: null,
	allTenants: false,
	tenantIds: [] as string[],
	replacePin: false,
	attachmentIds: [] as string[],
	...o
});

describe.skipIf(!url)('Interne Inhalte einer Abteilung', () => {
	let db: typeof import('./db/index.ts').db;
	let dbmod: typeof import('./db/index.ts');
	let access: typeof import('./auth/access.ts');
	let news: typeof import('./news.ts');
	const pr: Record<keyof typeof P, Principal> = {} as never;

	beforeAll(async () => {
		const { freshDatabase, migrateWithRetry } = await import('./db/test-db.ts');
		process.env.DATABASE_URL = await freshDatabase(url as string, 'intern');
		process.env.APP_DATABASE_PASSWORD ??= 'test-app-passwort';
		process.env.ENCRYPTION_KEY ??= Buffer.alloc(32, 7).toString('base64');
		dbmod = await import('./db/index.ts');
		db = dbmod.db;
		const { runMigrations } = await import('./db/migrate.ts');
		await migrateWithRetry(() => runMigrations());
		access = await import('./auth/access.ts');
		news = await import('./news.ts');
		await db.execute(
			sql`insert into tenants (id, name, short_name, is_main) values (${T}, 'Haus A', 'HA', true)`
		);
		await db.execute(sql`
			insert into persons (id, tenant_id, email, display_name, auth_source) values
				(${P.stamm}, ${T}, 's@haus-a.example', 'Sina Stamm', 'local'),
				(${P.mit}, ${T}, 'm@haus-a.example', 'Mo Mit', 'local'),
				(${P.leitung}, ${T}, 'l@haus-a.example', 'Lea Leitung', 'local'),
				(${P.verwaltung}, ${T}, 'v@haus-a.example', 'Vic Verwaltung', 'local'),
				(${P.red}, ${T}, 'r@haus-a.example', 'Rita Redaktion', 'local'),
				(${P.fremd}, ${T}, 'f@haus-a.example', 'Finn Fremd', 'local')`);
		await db.execute(sql`
			insert into units (id, tenant_id, type, name, slug, lead_person_id) values
				(${ABT}, ${T}, 'abteilung', 'Technik', 'technik', ${P.leitung}),
				(${HUB}, ${T}, 'hub', 'Chor', 'chor', null)`);
		await db.execute(sql`
			insert into unit_members (unit_id, person_id, is_primary, may_write_news, may_write_events, may_write_documents) values
				(${ABT}, ${P.stamm}, true, true, true, true),
				(${ABT}, ${P.mit}, false, false, false, false),
				(${HUB}, ${P.stamm}, false, true, false, false)`);
		await db.execute(sql`
			insert into role_assignments (person_id, role, scope, scope_tenant_id, scope_unit_id) values
				(${P.verwaltung}, 'abteilungsverwaltung', 'unit', null, ${ABT}),
				(${P.red}, 'redaktion', 'all', null, null)`);
		for (const [k, id] of Object.entries(P))
			pr[k as keyof typeof P] = await access.loadPrincipal({ id, tenantId: T });
	});

	afterAll(async () => {
		await dbmod?.closeDb();
	});

	const titel = async (p: Principal) =>
		(await news.listNews(p, { unitIds: [ABT] })).map((b) => b.title);

	it('interner Beitrag: Team, Leitung und Verwaltung sehen ihn, Redaktion und andere nicht', async () => {
		const r = await news.saveNews(pr.stamm, entwurf({ teamScope: 'mitglieder' }), '127.0.0.1');
		expect(r).toMatchObject({ ok: true });
		for (const k of ['stamm', 'mit', 'leitung', 'verwaltung'] as const)
			expect(await titel(pr[k]), k).toContain('Teambesprechung verschoben');
		for (const k of ['red', 'fremd'] as const) {
			expect(await titel(pr[k]), k).not.toContain('Teambesprechung verschoben');
			expect(await news.getNews(pr[k], (r as { id: string }).id), k).toBeNull();
		}
		// Schild „Intern · Technik“
		const [b] = await news.listNews(pr.mit, { unitIds: [ABT], intern: 'nur' });
		expect(b.audience).toBe('Intern · Technik');
		// Reiter „Neues“ der Abteilung zeigt ihn nicht
		expect(
			(await news.listNews(pr.mit, { unitIds: [ABT], intern: 'ohne' })).map((x) => x.title)
		).not.toContain('Teambesprechung verschoben');
	});

	it('Kreis „Stammabteilung“: Mitglieder ohne diese Stammabteilung sehen ihn nicht', async () => {
		await news.saveNews(pr.stamm, entwurf({ title: 'Nur Stamm', teamScope: 'stamm' }), '127.0.0.1');
		expect(await titel(pr.stamm)).toContain('Nur Stamm');
		expect(await titel(pr.leitung)).toContain('Nur Stamm');
		expect(await titel(pr.mit)).not.toContain('Nur Stamm');
	});

	it('die Datenbank erzwingt es auch ohne Prüfung im Code (Policy news_team)', async () => {
		const roh = (p: Principal) =>
			dbmod.scoped(p, (tx) =>
				tx.execute<{ title: string }>(sql`select title from news where team_scope is not null`)
			);
		expect((await roh(pr.fremd)).length).toBe(0);
		expect((await roh(pr.red)).length).toBe(0);
		expect((await roh(pr.mit)).map((r) => r.title)).toEqual(['Teambesprechung verschoben']);
		expect((await roh(pr.stamm)).length).toBe(2);
	});

	it('Speichern: ohne Anheften und Dringend, nur eigener Mandant, nur für das Team', async () => {
		const r = await news.saveNews(
			pr.stamm,
			entwurf({
				title: 'Mit Anheften',
				teamScope: 'mitglieder',
				pinnedUntil: new Date(Date.now() + 86400_000),
				urgentUntil: new Date(Date.now() + 3600_000),
				urgentText: 'Achtung'
			}),
			'127.0.0.1'
		);
		expect(r).toMatchObject({ ok: true });
		const [row] = await db.execute<{ p: Date | null; u: Date | null; a: boolean }>(
			sql`select pinned_until as p, urgent_until as u, all_tenants as a from news where title = 'Mit Anheften'`
		);
		expect(row).toMatchObject({ p: null, u: null, a: false });
		// Hubs schreiben nicht intern
		const hub = await news.saveNews(
			pr.stamm,
			entwurf({ unitId: HUB, title: 'Hub intern', teamScope: 'mitglieder' }),
			'127.0.0.1'
		);
		expect(hub).toMatchObject({ ok: false, errors: { tenants: /Abteilungen/ } });
	});

	it('Redaktion (Einheit ohne Pflege) darf nicht intern schreiben und interne nicht bearbeiten', async () => {
		// Abteilung ohne eigene Pflege: Verwaltungsrolle kurz entfernen
		await db.execute(sql`delete from role_assignments where role = 'abteilungsverwaltung'`);
		const red = await access.loadPrincipal({ id: P.red, tenantId: T });
		expect(red.ohnePflege).toContain(ABT);
		const r = await news.saveNews(
			red,
			entwurf({ title: 'Redaktion intern', teamScope: 'mitglieder' }),
			'127.0.0.1'
		);
		expect(r).toMatchObject({ ok: false, errors: { tenants: /Team/ } });
		const [{ id }] = await db.execute<{ id: string }>(
			sql`select id from news where title = 'Teambesprechung verschoben'`
		);
		expect(await news.newsForEdit(red, id)).toBeNull();
		await expect(news.deleteNews(red, id, '127.0.0.1')).rejects.toThrow();
		await db.execute(sql`
			insert into role_assignments (person_id, role, scope, scope_unit_id)
			values (${P.verwaltung}, 'abteilungsverwaltung', 'unit', ${ABT})`);
	});

	it('Benachrichtigung nur an das Team, je nach Kreis', async () => {
		const { teamEmpfaenger } = await import('./notify.ts');
		expect((await teamEmpfaenger(ABT, 'mitglieder')).sort()).toEqual(
			[P.stamm, P.mit, P.leitung, P.verwaltung].sort()
		);
		expect((await teamEmpfaenger(ABT, 'stamm')).sort()).toEqual(
			[P.stamm, P.leitung, P.verwaltung].sort()
		);
	});

	it('interne Termine: Kalender, Suche und Abo nur für das Team', async () => {
		const cal = await import('./calendar.ts');
		const morgen = new Date(Date.now() + 86400_000).toISOString().slice(0, 10);
		const r = await cal.saveEvent(pr.stamm, null, {
			unitId: ABT,
			title: 'Teamrunde',
			date: morgen,
			allDay: true,
			startTime: '',
			endTime: '',
			place: '',
			description: '',
			allTenants: false,
			tenantIds: [],
			teamScope: 'mitglieder'
		});
		expect(r).toMatchObject({ ok: true });
		const liste = async (p: Principal) =>
			(await cal.listEvents(p, { from: morgen, to: morgen, tenantIds: [] })).map((e) => e.title);
		expect(await liste(pr.mit)).toContain('Teamrunde');
		expect(await liste(pr.fremd)).not.toContain('Teamrunde');
		expect(await liste(pr.red)).not.toContain('Teamrunde');
		expect(await cal.getEvent(pr.fremd, (r as { id: string }).id)).toBeNull();
		expect((await cal.interneTermine(pr.mit, ABT)).map((e) => e.title)).toEqual(['Teamrunde']);
		expect(await cal.interneTermine(pr.fremd, ABT)).toEqual([]);
		// Abo-Link: je Person
		const feed = async (p: Principal) => {
			await cal.saveFeed(p, cal.DEFAULT_FEED);
			const f = await cal.getFeed(p, 'https://intranet.example');
			const token = String(f?.url ?? '')
				.split('/ical/')[1]
				.replace('.ics', '');
			return ((await cal.feedEvents(token)) ?? []).map((e) => e.title);
		};
		expect(await feed(pr.mit)).toContain('Teamrunde');
		expect(await feed(pr.fremd)).not.toContain('Teamrunde');
		// Fremde Person darf intern nicht eintragen
		const fremd = await cal
			.saveEvent(pr.red, null, {
				unitId: ABT,
				title: 'Redaktion intern',
				date: morgen,
				allDay: true,
				startTime: '',
				endTime: '',
				place: '',
				description: '',
				allTenants: false,
				tenantIds: [],
				teamScope: 'mitglieder'
			})
			.catch(() => ({ ok: false }));
		expect(fremd.ok).toBe(false);
	});

	it('interne Ordner: nur für das Team lesbar, Dateien nur für das Team abrufbar', async () => {
		const hi = await import('./hub-inhalte.ts');
		await db.execute(sql`insert into files (id, name, mime, kind, size, key_enc, created_by) values
			(${DATEI}, 'dienstplan.pdf', 'application/pdf', 'pdf', 100, 'x', ${P.stamm})`);
		await db.execute(sql`insert into unit_document_folders (id, unit_id, name, intern) values
			(${ORDNER}, ${ABT}, 'Vorlagen intern', true)`);
		await db.execute(sql`insert into unit_documents (unit_id, folder_id, file_id, title) values
			(${ABT}, ${ORDNER}, ${DATEI}, 'Dienstplan')`);
		const dep = await import('./departments.ts');
		const mit = await dep.getDepartment(pr.mit, 'technik');
		expect(mit?.internDokumente.map((d) => d.title)).toEqual(['Dienstplan']);
		expect(mit?.dokumente).toEqual([]);
		const fremd = await dep.getDepartment(pr.fremd, 'technik');
		expect(fremd?.internDokumente).toEqual([]);
		expect(fremd?.internErlaubt).toBe(false);
		expect(await hi.hubDateiErlaubt(pr.mit, DATEI)).toBe(true);
		expect(await hi.hubDateiErlaubt(pr.fremd, DATEI)).toBe(false);
		expect(await hi.hubDateiErlaubt(pr.red, DATEI)).toBe(false);
	});

	it('Pflegen ohne Teamzugang lässt interne Ordner und Dokumente unberührt', async () => {
		const { dokumenteSpeichern } = await import('./hub-pflege.ts');
		// System-Admin pflegt Dokumente, gehört aber nicht zum Team
		await db.execute(sql`
			insert into role_assignments (person_id, role, scope) values (${P.fremd}, 'system_admin', 'all')`);
		const admin = await access.loadPrincipal({ id: P.fremd, tenantId: T });
		await dokumenteSpeichern(admin, ABT, [], [], ['vorlagen intern']);
		const [{ n }] = await db.execute<{ n: number }>(
			sql`select count(*)::int as n from unit_documents where unit_id = ${ABT}`
		);
		expect(n).toBe(1);
		// Das Team gibt den Ordner frei
		await dokumenteSpeichern(
			pr.stamm,
			ABT,
			[
				{
					id: (await db.execute<{ id: string }>(sql`select id from unit_documents`))[0].id,
					title: 'Dienstplan',
					ordner: 'Vorlagen intern'
				}
			],
			[],
			[]
		);
		const [{ intern }] = await db.execute<{ intern: boolean }>(
			sql`select intern from unit_document_folders where id = ${ORDNER}`
		);
		expect(intern).toBe(false);
	});
});
