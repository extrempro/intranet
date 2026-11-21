/**
 * Teams-Benachrichtigungen (Kap. 11.1) über den Aktivitätsfeed von Microsoft
 * Graph (teamwork/sendActivityNotificationToRecipients).
 *
 * Voraussetzungen:
 * - Anwendungsberechtigung TeamsActivity.Send (Administratorzustimmung)
 * - Teams-App aus Verwaltung → Benachrichtigungen im Teams Admin Center
 *   hochgeladen und per Setup-Richtlinie installiert; ohne installierte App
 *   kommt bei der Person nichts an
 * - Nur Microsoft-Konten (Entra-Objekt-ID); Ruhezeiten wie bei Push
 */
import { and, eq, inArray, isNotNull, isNull, lt, lte, or, sql } from 'drizzle-orm';
import {
	activityBody,
	activityFor,
	TEAMS_TAB_ENTITY,
	TEAMS_TEST_ENTITY,
	type TeamsItem
} from '../teams.ts';
import { teamsAppAussehen } from './teams-marke.ts';
import { teamsResource } from './teams-sso.ts';
import { getEntraConfig, GraphError, graphAppPost } from './auth/entra.ts';
import { db } from './db/index.ts';
import { notifications, persons } from './db/schema.ts';
import { getSetting, setSetting } from './settings.ts';
import { teamsActive, teamsSettings } from './teams-config.ts';
import { zip } from './zip.ts';

/**
 * Reiter „Test“ im App-Paket (SSO, Cookies, Sprung aus Benachrichtigung).
 * Nach den Tests auf iPhone und Android auf false setzen und /teams/test entfernen.
 */
export const TEAMS_TEST_REITER = true;

export type GraphPost = (path: string, body: unknown) => Promise<void>;

export interface TeamsStatus {
	zeit: string;
	ok: boolean;
	gesendet: number;
	meldung: string;
}

const BULK = 100;
const ENDPOINT = '/teamwork/sendActivityNotificationToRecipients';

export function teamsFehlertext(err: unknown): string {
	if (err instanceof GraphError) {
		if (err.status === 401 || err.status === 403)
			return `Microsoft lehnt ab (${err.message}): Anwendungsberechtigung TeamsActivity.Send fehlt, oder die Teams-App gehört zu einer anderen App-Registrierung.`;
		if (err.status === 412)
			return `Microsoft lehnt das Token ab (${err.message}): Es ist zu kurz gültig. Ist die Token-Lebensdauer per Richtlinie unter 50 Minuten gesetzt?`;
		if (err.status === 404)
			return `Microsoft findet die Person oder die App nicht (${err.message}): Ist die Teams-App für sie installiert?`;
		return err.message;
	}
	const msg = err instanceof Error ? err.message : '';
	if (/fetch failed|ECONN|ENOTFOUND|ETIMEDOUT|timeout|aborted/i.test(msg))
		return 'Microsoft ist nicht erreichbar (Netzwerk, Firewall oder Proxy). Der Server braucht ausgehend login.microsoftonline.com und graph.microsoft.com.';
	if (/invalid_client|unauthorized_client|AADSTS/i.test(msg))
		return 'Anmeldung der App bei Microsoft abgelehnt: Client-ID oder Secret prüfen (Verwaltung → Anmeldung → „Verbindung prüfen“).';
	return msg.slice(0, 200) || 'Unbekannter Fehler';
}

let laeuft = false;

/** Läuft gerade ein Versand? (für Tests) */
export function teamsBusy(): boolean {
	return laeuft;
}

/** Fällige Teams-Meldungen senden (minütlich und sofort nach dem Anlegen). */
export async function sendDueTeams(
	post: GraphPost = graphAppPost,
	now = new Date()
): Promise<number> {
	if (laeuft || !(await teamsActive())) return 0;
	laeuft = true;
	try {
		// Ohne Microsoft-Konto oder älter als ein Tag: verwerfen statt ewig liegen lassen
		await db
			.update(notifications)
			.set({ teams: 'sent' })
			.where(
				and(
					eq(notifications.teams, 'pending'),
					or(
						lt(notifications.createdAt, sql`now() - interval '1 day'`),
						sql`not exists (select 1 from persons p where p.id = ${notifications.personId} and p.entra_oid is not null and p.status = 'active')`
					)
				)
			);
		const rows = await db
			.select({
				id: notifications.id,
				oid: persons.entraOid,
				title: notifications.title,
				detail: notifications.detail,
				link: notifications.link
			})
			.from(notifications)
			.innerJoin(persons, eq(persons.id, notifications.personId))
			.where(
				and(
					eq(notifications.teams, 'pending'),
					isNotNull(persons.entraOid),
					or(isNull(notifications.pushAfter), lte(notifications.pushAfter, now))
				)
			)
			.orderBy(notifications.createdAt)
			.limit(5000);
		if (rows.length === 0) return 0;

		// Je Person eine Meldung (mehrere nach der Ruhezeit zusammengefasst),
		// gleiche Meldungen gesammelt an bis zu 100 Personen
		const proPerson = new Map<string, { ids: string[]; items: TeamsItem[] }>();
		for (const r of rows) {
			const e = proPerson.get(r.oid!) ?? { ids: [], items: [] };
			e.ids.push(r.id);
			e.items.push({ title: r.title, detail: r.detail, link: r.link });
			proPerson.set(r.oid!, e);
		}
		const gruppen = new Map<
			string,
			{ a: ReturnType<typeof activityFor>; oids: string[]; ids: string[] }
		>();
		for (const [oid, e] of proPerson) {
			const a = activityFor(e.items);
			const key = JSON.stringify(a);
			const g = gruppen.get(key) ?? { a, oids: [], ids: [] };
			g.oids.push(oid);
			g.ids.push(...e.ids);
			gruppen.set(key, g);
		}

		const { appId } = await teamsSettings();
		let gesendet = 0;
		let fehler = '';
		for (const g of gruppen.values()) {
			for (let i = 0; i < g.oids.length; i += BULK) {
				const oids = g.oids.slice(i, i + BULK);
				try {
					await post(ENDPOINT, activityBody(appId, g.a, oids));
					gesendet += oids.length;
				} catch (err) {
					fehler = teamsFehlertext(err);
					console.error('Teams-Benachrichtigung fehlgeschlagen:', fehler);
				}
			}
			// Auch bei Fehlern als erledigt markieren: ein erneuter Versuch hilft bei
			// fehlender Berechtigung nicht und würde später doppelt melden
			await db.update(notifications).set({ teams: 'sent' }).where(inArray(notifications.id, g.ids));
		}
		await setSetting(
			'teams.status',
			{ zeit: now.toISOString(), ok: !fehler, gesendet, meldung: fehler } satisfies TeamsStatus,
			null
		);
		return gesendet;
	} finally {
		laeuft = false;
	}
}

export async function teamsStatus(): Promise<TeamsStatus | null> {
	return getSetting<TeamsStatus | null>('teams.status', null);
}

/** Testmeldung an die eigene Person (nur Microsoft-Konten). */
export async function sendTeamsTest(
	personId: string,
	post: GraphPost = graphAppPost,
	/** true: Klick öffnet den Test-Tab mit einem Ziel, um den Sprung zu prüfen */
	testTab = false
): Promise<string> {
	const [p] = await db
		.select({ oid: persons.entraOid })
		.from(persons)
		.where(eq(persons.id, personId));
	if (!p?.oid) throw new Error('Teams-Tests gehen nur mit einem Microsoft-Konto.');
	if (!(await getEntraConfig()))
		throw new Error('Die Anmeldung mit Microsoft ist nicht eingerichtet.');
	const { appId } = await teamsSettings();
	try {
		await post(
			ENDPOINT,
			activityBody(
				appId,
				activityFor([
					{
						title: testTab ? 'Test: Sprung in den Test-Tab' : 'Testmeldung aus dem Intranet',
						detail: 'Intranet',
						link: testTab ? '/sprung-angekommen' : '/'
					}
				]),
				[p.oid],
				testTab ? TEAMS_TEST_ENTITY : TEAMS_TAB_ENTITY
			)
		);
	} catch (err) {
		throw new Error(teamsFehlertext(err), { cause: err });
	}
	return 'Testmeldung verschickt. Sie erscheint in Teams unter „Aktivität“, wenn die App bei dir installiert ist.';
}

/** Teams-App-Paket (manifest.json, Symbole) für das Teams Admin Center. */
export async function teamsAppPackage(origin: string): Promise<{ name: string; data: Uint8Array }> {
	const entra = await getEntraConfig();
	if (!entra)
		throw new Error('Die Anmeldung mit Microsoft ist nicht eingerichtet (Client-ID fehlt).');
	const [{ appId, version }, aussehen] = await Promise.all([teamsSettings(), teamsAppAussehen()]);
	const m = aussehen.marke;
	const host = new URL(origin).host;
	const manifest = {
		$schema: 'https://developer.microsoft.com/json-schemas/teams/v1.19/MicrosoftTeams.schema.json',
		manifestVersion: '1.19',
		version: `1.0.${version}`,
		id: appId,
		developer: {
			name: m.herausgeber,
			websiteUrl: origin,
			// Datenschutz und Impressum des Hauptmandanten, sonst Rechtliches im Intranet
			privacyUrl: aussehen.datenschutz ?? `${origin}/rechtliches`,
			termsOfUseUrl: aussehen.impressum ?? `${origin}/rechtliches`
		},
		name: { short: m.kurzname, full: m.langname },
		description: { short: m.kurzbeschreibung, full: m.langbeschreibung },
		icons: { color: 'color.png', outline: 'outline.png' },
		accentColor: m.farbe,
		staticTabs: [
			{
				entityId: TEAMS_TAB_ENTITY,
				name: m.kurzname,
				contentUrl: `${origin}/teams/app?ziel={subEntityId}`,
				websiteUrl: origin,
				scopes: ['personal']
			},
			...(TEAMS_TEST_REITER
				? [
						{
							// Vorübergehend: prüft, ob das Intranet ganz in Teams laufen kann
							entityId: TEAMS_TEST_ENTITY,
							name: 'Test',
							contentUrl: `${origin}/teams/test?ziel={subEntityId}`,
							scopes: ['personal']
						}
					]
				: [])
		],
		validDomains: [host],
		webApplicationInfo: { id: entra.clientId, resource: teamsResource(origin, entra.clientId) },
		showLoadingIndicator: false
	};
	const data = zip([
		{ name: 'manifest.json', data: new TextEncoder().encode(JSON.stringify(manifest, null, 2)) },
		{ name: 'color.png', data: aussehen.farbig },
		{ name: 'outline.png', data: aussehen.umriss }
	]);
	return { name: `intranet-teams-${version}.zip`, data };
}
