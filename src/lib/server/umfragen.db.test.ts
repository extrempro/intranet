/**
 * Umfragen (Kap. 8.16) mit echter Datenbank: Recht, Schalter in der
 * Verwaltung, Anonymität, keine doppelte Teilnahme, Sichtbarkeit, Sperre
 * nach der ersten Antwort, CSV. Läuft nur mit TEST_DATABASE_URL; eigene
 * Datenbank <name>_umfragen.
 */
import { sql } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Membership, Principal } from './auth/access.ts';
import type { UmfrageEingabe } from '../umfrage.ts';

const url = process.env.TEST_DATABASE_URL;
const T = '00000000-0000-0000-0000-000000000001';
const U = '00000000-0000-0000-0000-0000000000a1';
const P = {
	team: '00000000-0000-0000-0000-0000000000b1',
	redaktion: '00000000-0000-0000-0000-0000000000b2',
	a: '00000000-0000-0000-0000-0000000000b3',
	b: '00000000-0000-0000-0000-0000000000b4'
};
const N = {
	anonym: '00000000-0000-4000-8000-00000000c001',
	namentlich: '00000000-0000-4000-8000-00000000c002'
};

const mitglied = (rechte: Partial<Membership>): Membership => ({
	unitId: U,
	isPrimary: true,
	mayWriteNews: true,
	mayWriteFaqs: false,
	mayWriteEvents: false,
	mayWriteBehindScenes: false,
	...rechte
});
const principal = (personId: string, memberships: Membership[] = []): Principal => ({
	personId,
	tenantId: T,
	roles: [],
	memberships
});

function umfrage(o: Partial<UmfrageEingabe> = {}): UmfrageEingabe {
	return {
		anonym: true,
		ergebnis: 'alle',
		ab: 'antwort',
		ende: '2099-01-10T12:00',
		fragen: [
			{
				art: 'auswahl',
				text: 'Pizza oder Pasta?',
				pflicht: true,
				mehrfach: false,
				optionen: ['Pizza', 'Pasta']
			},
			{ art: 'freitext', text: 'Sonst noch was?', pflicht: false, mehrfach: false, optionen: [] }
		],
		...o
	};
}

function antwort(werte: Record<string, string>) {
	const fd = new FormData();
	for (const [k, v] of Object.entries(werte)) fd.append(k, v);
	return fd;
}

describe.skipIf(!url)('Umfragen', () => {
	let db: typeof import('./db/index.ts').db;
	let um: typeof import('./umfragen.ts');
	let rules: typeof import('./rules.ts');
	const team = principal(P.team, [mitglied({ mayWriteSurveys: true })]);
	const redaktion = principal(P.redaktion, [mitglied({})]);
	const a = principal(P.a);
	const b = principal(P.b);
	const fragen: string[] = [];

	beforeAll(async () => {
		const { freshDatabase, migrateWithRetry } = await import('./db/test-db.ts');
		process.env.DATABASE_URL = await freshDatabase(url as string, 'umfragen');
		process.env.APP_DATABASE_PASSWORD ??= 'test-app-passwort';
		db = (await import('./db/index.ts')).db;
		const { runMigrations } = await import('./db/migrate.ts');
		await migrateWithRetry(() => runMigrations());
		um = await import('./umfragen.ts');
		rules = await import('./rules.ts');
		await db.execute(
			sql`insert into tenants (id, name, short_name, is_main) values (${T}, 'Haus A', 'BH', true)`
		);
		await db.execute(sql`
			insert into units (id, tenant_id, type, name, slug, is_central) values
				(${U}, ${T}, 'abteilung', 'Kantine', 'kantine', false)`);
		await db.execute(sql`
			insert into persons (id, tenant_id, email, display_name, auth_source) values
				(${P.team}, ${T}, 't@haus-a.example', 'Team Person', 'local'),
				(${P.redaktion}, ${T}, 'r@haus-a.example', 'Redaktion Person', 'local'),
				(${P.a}, ${T}, 'a@haus-a.example', 'Anna A', 'local'),
				(${P.b}, ${T}, 'b@haus-a.example', 'Ben B', 'local')`);
		await db.execute(sql`
			insert into unit_members (unit_id, person_id, may_write_news, may_write_surveys) values
				(${U}, ${P.team}, true, true), (${U}, ${P.redaktion}, true, false)`);
		await db.execute(sql`
			insert into news (id, unit_id, tenant_id, title, body_html, body_text, publish_at, all_tenants) values
				(${N.anonym}, ${U}, ${T}, 'Essen', '<p>x</p>', 'x', now() - interval '1 hour', true),
				(${N.namentlich}, ${U}, ${T}, 'Sommerfest', '<p>x</p>', 'x', now() - interval '1 hour', true)`);
	});

	it('Schalter in der Verwaltung ist voreingestellt aus', async () => {
		expect((await rules.getContentRules()).surveys).toBe(false);
		await expect(um.umfrageSpeichern(team, N.anonym, umfrage(), '127.0.0.1')).rejects.toThrow(
			/ausgeschaltet/
		);
		const r = await rules.getContentRules();
		await rules.saveContentRules({ ...r, surveys: true }, P.team, '127.0.0.1');
	});

	it('zusätzlich je Abteilung/Hub freischalten (Standard aus)', async () => {
		await expect(um.umfrageSpeichern(team, N.anonym, umfrage(), '127.0.0.1')).rejects.toThrow(
			/nicht freigeschaltet/
		);
		const v = await um.umfrageVorpruefen(
			team,
			{ id: U, tenantId: T, isCentral: false },
			JSON.stringify(umfrage())
		);
		expect(v.fehler).toMatch(/nicht freigeschaltet/);
		const [e] = await um.mitUmfrageRecht(team, [{ id: U, tenantId: T, isCentral: false }]);
		expect(e).toMatchObject({ mayUmfrage: true, umfrageFrei: false });
		await db.execute(sql`update units set surveys = true where id = ${U}`);
		const [f] = await um.mitUmfrageRecht(team, [{ id: U, tenantId: T, isCentral: false }]);
		expect(f.umfrageFrei).toBe(true);
	});

	it('ohne Recht „Umfragen“ keine Umfrage, auch nicht mit Recht für Neuigkeiten', async () => {
		await expect(um.umfrageSpeichern(redaktion, N.anonym, umfrage(), '127.0.0.1')).rejects.toThrow(
			/Recht „Umfragen“/
		);
		const v = await um.umfrageVorpruefen(
			redaktion,
			{ id: U, tenantId: T, isCentral: false },
			JSON.stringify(umfrage())
		);
		expect(v.fehler).toMatch(/Recht „Umfragen“/);
		// Fehlt das Feld (Editor nicht angezeigt), bleibt alles, wie es ist
		expect(await um.umfrageVorpruefen(redaktion, undefined, undefined, N.anonym)).toEqual({
			aendern: false
		});
	});

	it('Team legt an; Ende in der Vergangenheit wird abgelehnt', async () => {
		const v = await um.umfrageVorpruefen(
			team,
			{ id: U, tenantId: T, isCentral: false },
			JSON.stringify(umfrage({ ende: '2020-01-01T12:00' }))
		);
		expect(v.fehler).toMatch(/Zukunft/);
		await um.umfrageSpeichern(team, N.anonym, umfrage(), '127.0.0.1');
		await um.umfrageSpeichern(
			team,
			N.namentlich,
			umfrage({ anonym: false, ergebnis: 'team' }),
			'127.0.0.1'
		);
		const u = await um.umfrageFuerBeitrag(a, N.anonym);
		expect(u?.fragen.map((f) => f.text)).toEqual(['Pizza oder Pasta?', 'Sonst noch was?']);
		expect(u?.teamNamen).toEqual(['Team Person']);
		fragen.push(...u!.fragen.map((f) => f.id));
		expect((await um.offeneUmfragen(a)).map((o) => o.titel).sort()).toEqual([
			'Essen',
			'Sommerfest'
		]);
	});

	it('Pflichtfragen werden gemeldet', async () => {
		const r = await um.antwortenSpeichern(a, N.anonym, antwort({}));
		expect(r.fehlend).toEqual([fragen[0]]);
	});

	it('anonym: ohne Person gespeichert, nur einmal, danach nicht änderbar', async () => {
		await um.antwortenSpeichern(
			a,
			N.anonym,
			antwort({ [`q-${fragen[0]}`]: '1', [`q-${fragen[1]}`]: 'Mehr Salat' })
		);
		const rows = await db.execute(
			sql`select a.person_id from survey_answers a join surveys s on s.id = a.survey_id where s.news_id = ${N.anonym}`
		);
		expect(rows).toHaveLength(2);
		expect(rows.every((r) => r.person_id === null)).toBe(true);
		await expect(
			um.antwortenSpeichern(a, N.anonym, antwort({ [`q-${fragen[0]}`]: '0' }))
		).rejects.toThrow();
		const u = await um.umfrageFuerBeitrag(a, N.anonym);
		expect(u).toMatchObject({ teilgenommen: true, aenderbar: false, teilnehmende: 1 });
		expect((await um.offeneUmfragen(a)).map((o) => o.titel)).toEqual(['Sommerfest']);
	});

	it('Ergebnis „nach der eigenen Antwort“; Freitexte nur für das Team, anonym ohne Namen', async () => {
		expect((await um.umfrageFuerBeitrag(b, N.anonym))?.ergebnisse).toBeNull();
		const fuerA = await um.umfrageFuerBeitrag(a, N.anonym);
		expect(fuerA?.ergebnisse?.[0].zeilen.map((z) => z.anzahl)).toEqual([0, 1]);
		expect(fuerA?.ergebnisse?.[1].texte).toBeNull();
		const fuerTeam = await um.umfrageFuerBeitrag(team, N.anonym);
		expect(fuerTeam?.ergebnisse?.[1].texte).toEqual([{ text: 'Mehr Salat', name: null }]);
	});

	it('nach der ersten Antwort: Fragen und „Anonym“ gesperrt, Ende änderbar', async () => {
		await um.umfrageSpeichern(
			team,
			N.anonym,
			umfrage({ anonym: false, ende: '2099-02-01T12:00', fragen: [] }),
			'127.0.0.1'
		);
		const e = await um.umfrageFuerEditor(N.anonym);
		expect(e.gesperrt).toBe(true);
		expect(e.wert).toMatchObject({ anonym: true, ende: '2099-02-01T12:00' });
		expect(e.wert?.fragen).toHaveLength(2);
		await expect(um.umfrageSpeichern(team, N.anonym, null, '127.0.0.1')).rejects.toThrow(
			/Beende sie/
		);
	});

	it('namentlich: Antwort änderbar, Ergebnis nur für das Team', async () => {
		const [f1] = (await um.umfrageFuerBeitrag(b, N.namentlich))!.fragen.map((f) => f.id);
		await um.antwortenSpeichern(b, N.namentlich, antwort({ [`q-${f1}`]: '0' }));
		await um.antwortenSpeichern(b, N.namentlich, antwort({ [`q-${f1}`]: '1' }));
		const u = await um.umfrageFuerBeitrag(b, N.namentlich);
		expect(u).toMatchObject({
			teilgenommen: true,
			aenderbar: true,
			teilnehmende: 1,
			ergebnisse: null
		});
		expect(u?.fragen[0].meine).toEqual([1]);
		const t = await um.umfrageFuerBeitrag(team, N.namentlich);
		expect(t?.ergebnisse?.[0].zeilen.map((z) => z.anzahl)).toEqual([0, 1]);
	});

	it('CSV nur für das Team; anonym ohne Namen, namentlich mit', async () => {
		expect(await um.umfrageCsv(a, N.anonym)).toBeNull();
		expect(await um.umfrageCsv(redaktion, N.anonym)).toBeNull();
		const anonym = await um.umfrageCsv(team, N.anonym);
		expect(anonym?.csv.startsWith('﻿')).toBe(true);
		expect(anonym?.csv).toContain('Mehr Salat');
		expect(anonym?.csv).not.toContain('Anna');
		const namentlich = await um.umfrageCsv(team, N.namentlich);
		expect(namentlich?.csv).toContain('Ben B');
	});

	it('Freischaltung zurückgenommen: laufende Umfragen bleiben, neue nicht', async () => {
		await db.execute(sql`update units set surveys = false where id = ${U}`);
		const n = '00000000-0000-4000-8000-00000000c003';
		await db.execute(sql`
			insert into news (id, unit_id, tenant_id, title, body_html, body_text, publish_at, all_tenants) values
				(${n}, ${U}, ${T}, 'Neu', '<p>x</p>', 'x', now() - interval '1 hour', true)`);
		await expect(um.umfrageSpeichern(team, n, umfrage(), '127.0.0.1')).rejects.toThrow(
			/nicht freigeschaltet/
		);
		await um.umfrageSpeichern(team, N.anonym, umfrage({ ende: '2099-03-01T12:00' }), '127.0.0.1');
		expect((await um.umfrageFuerEditor(N.anonym)).wert?.ende).toBe('2099-03-01T12:00');
	});

	it('Beenden nur mit Recht; danach keine Antworten mehr', async () => {
		await expect(um.umfrageBeenden(redaktion, N.namentlich, '127.0.0.1')).rejects.toThrow();
		await um.umfrageBeenden(team, N.namentlich, '127.0.0.1');
		await expect(um.antwortenSpeichern(a, N.namentlich, antwort({ [`q-x`]: '0' }))).rejects.toThrow(
			/beendet/
		);
		expect(await um.offeneUmfragen(a)).toEqual([]);
	});
});
