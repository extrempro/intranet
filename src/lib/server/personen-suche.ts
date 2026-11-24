/**
 * Personen für ein Team suchen und hinzufügen (Kap. 5.2): Verwaltung,
 * Abteilungen, Geschäftsführung, Stabsstellen und Hubs. Die Suche findet
 * Personen im Intranet und – wenn Entra eingerichtet ist – Mitglieder der
 * Zugangsgruppe, die sich noch nie angemeldet haben. Wählt das Team so eine
 * Person, wird ihr Konto gleich angelegt: Mandant und Rollen wie bei der
 * Anmeldung aus Entra.
 */
import { and, asc, eq, ilike, inArray, ne, notInArray, or, sql } from 'drizzle-orm';
import { tenantFromEmail } from '../tenant.ts';
import { audit } from './audit.ts';
import type { Principal } from './auth/access.ts';
import { getEntraConfig, graphAppGet } from './auth/entra.ts';
import { resolveEntraLogin } from './auth/entra-login.ts';
import { loadLoginContext, upsertEntraPerson } from './auth/entra-persist.ts';
import { graphClient, type GraphClient } from './auth/entra-sync.ts';
import { db } from './db/index.ts';
import { locationOperators, persons, tenants } from './db/schema.ts';
import { photosOf } from './people.ts';
import { seedFavorites } from './preferences.ts';
import { limiter } from './rate-limit.ts';
import { teamEinheit, UnitError } from './units.ts';

export interface PersonTreffer {
	/** Personen-ID, bei Entra-Treffern `entra:<Object-ID>` */
	id: string;
	name: string;
	email: string;
	position: string | null;
	abteilung: string | null;
	mandant: string;
	foto: string | null;
	/** Noch nicht im Intranet, kommt aus Entra */
	entra?: boolean;
}

export const ENTRA_PRAEFIX = 'entra:';
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Graph-Abfragen je Person begrenzen (Suche als Live-Suche) */
const entraLimit = limiter(120, 60_000);

interface GraphTreffer {
	id: string;
	displayName?: string | null;
	mail?: string | null;
	userPrincipalName?: string | null;
	jobTitle?: string | null;
	department?: string | null;
	accountEnabled?: boolean | null;
}

/** Zentrale Hubs sind für alle Mandanten offen, sonst nur der eigene Mandant. */
function offenFuerAlle(unit: { type: string; isCentral: boolean }) {
	return unit.type === 'hub' && unit.isCentral;
}

export async function teamPersonenSuchen(
	p: Principal,
	unitId: string,
	q: string,
	graph: { suchen: (text: string) => Promise<GraphTreffer[]> } = entraGraph
): Promise<PersonTreffer[]> {
	const { unit } = await teamEinheit(p, unitId);
	const text = q.trim().slice(0, 60);
	if (text.length < 2) return [];
	const mandant = offenFuerAlle(unit) ? null : unit.tenantId;
	const muster = `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
	const rows = await db
		.select({
			id: persons.id,
			name: persons.displayName,
			email: persons.email,
			position: persons.position,
			mandant: tenants.shortName,
			abteilung: sql<
				string | null
			>`(select un.name from unit_members m join units un on un.id = m.unit_id
				where m.person_id = ${persons.id} and m.is_primary and un.type <> 'hub' limit 1)`
		})
		.from(persons)
		.innerJoin(tenants, eq(tenants.id, persons.tenantId))
		.where(
			and(
				ne(persons.status, 'disabled'),
				eq(persons.hidden, false),
				mandant ? eq(persons.tenantId, mandant) : undefined,
				notInArray(
					persons.id,
					db.select({ id: locationOperators.personId }).from(locationOperators)
				),
				or(ilike(persons.displayName, muster), ilike(persons.email, muster))
			)
		)
		.orderBy(asc(persons.displayName))
		.limit(8);
	const fotos = await photosOf(rows.map((r) => r.id));
	const lokal: PersonTreffer[] = rows.map((r) => ({ ...r, foto: fotos.get(r.id) ?? null }));

	let entra: PersonTreffer[] = [];
	if (entraLimit.hit(p.personId)) {
		try {
			entra = await entraTreffer(await graph.suchen(text), mandant);
		} catch (err) {
			// Entra nicht erreichbar: lokale Treffer reichen
			console.error('Personensuche in Entra fehlgeschlagen:', err);
		}
	}
	return [...lokal, ...entra].slice(0, 12);
}

/** Entra-Treffer ohne Konto im Intranet, mit bekanntem Mandanten. */
async function entraTreffer(liste: GraphTreffer[], mandant: string | null) {
	if (liste.length === 0) return [];
	const oids = liste.map((u) => u.id).filter((id) => GUID.test(id));
	const mails = liste
		.map((u) => (u.mail ?? u.userPrincipalName ?? '').toLowerCase())
		.filter(Boolean);
	const [vorhanden, ctx, mandanten] = await Promise.all([
		oids.length
			? db
					.select({ oid: persons.entraOid, email: persons.email })
					.from(persons)
					.where(
						or(
							inArray(persons.entraOid, oids),
							mails.length ? inArray(sql`lower(${persons.email})`, mails) : undefined
						)
					)
			: [],
		loadLoginContext(),
		db.select({ id: tenants.id, kurz: tenants.shortName }).from(tenants)
	]);
	const bekannt = new Set(vorhanden.flatMap((v) => [v.oid, v.email.toLowerCase()]));
	const out: PersonTreffer[] = [];
	for (const u of liste) {
		const email = (u.mail ?? u.userPrincipalName ?? '').trim();
		if (!GUID.test(u.id) || !email.includes('@') || u.accountEnabled === false) continue;
		if (bekannt.has(u.id) || bekannt.has(email.toLowerCase())) continue;
		const t = tenantFromEmail(email, ctx.domains);
		if (!t || (mandant && t !== mandant)) continue;
		out.push({
			id: ENTRA_PRAEFIX + u.id,
			name: u.displayName?.trim() || email,
			email,
			position: u.jobTitle?.trim() || null,
			abteilung: u.department?.trim() || null,
			mandant: mandanten.find((m) => m.id === t)?.kurz ?? '',
			foto: null,
			entra: true
		});
	}
	return out;
}

/** Graph: Mitglieder der Zugangsgruppe nach Anzeigename (nur der wird von Graph durchsucht). */
const entraGraph = {
	async suchen(text: string): Promise<GraphTreffer[]> {
		const cfg = await getEntraConfig();
		if (!cfg?.accessGroupId) return [];
		const sauber = text.replace(/["\\]/g, '').trim();
		if (sauber.length < 2) return [];
		const suche = encodeURIComponent(`"displayName:${sauber}"`);
		const body = await graphAppGet<{ value: GraphTreffer[] }>(
			`/groups/${cfg.accessGroupId}/transitiveMembers/microsoft.graph.user?$search=${suche}&$count=true&$top=8&$select=id,displayName,mail,userPrincipalName,jobTitle,department,accountEnabled`,
			{ ConsistencyLevel: 'eventual' }
		);
		return body?.value ?? [];
	}
};

/**
 * Wahl aus der Suche in eine Personen-ID umsetzen. Entra-Treffer bekommen
 * jetzt ihr Konto (wie bei der Anmeldung: Zugangsgruppe, Mandant, Rollen).
 */
export async function personAusWahl(
	p: Principal,
	unitId: string,
	wahl: string,
	ip: string,
	graph: GraphClient = graphClient
): Promise<string> {
	const w = wahl.trim();
	if (!w.startsWith(ENTRA_PRAEFIX)) return w;
	const { unit } = await teamEinheit(p, unitId);
	const oid = w.slice(ENTRA_PRAEFIX.length);
	if (!GUID.test(oid)) throw new UnitError('Diese Person gibt es nicht.');
	const [da] = await db.select({ id: persons.id }).from(persons).where(eq(persons.entraOid, oid));
	if (da) return da.id;

	const entra = await getEntraConfig();
	const gefunden = entra ? await graph.lookup(oid) : null;
	if (!entra || !gefunden) throw new UnitError('Diese Person gibt es in Entra nicht (mehr).');
	const ctx = await loadLoginContext();
	const entscheidung = resolveEntraLogin({
		email: gefunden.user.mail ?? gefunden.user.userPrincipalName ?? '',
		groupIds: gefunden.groupIds,
		accountEnabled: gefunden.user.accountEnabled !== false,
		accessGroupId: entra.accessGroupId,
		domains: ctx.domains,
		mappings: ctx.mappings
	});
	if (!entscheidung.ok)
		throw new UnitError(
			'Diese Person darf das Intranet laut Entra nicht nutzen (Zugangsgruppe, Konto oder Domain).'
		);
	if (!offenFuerAlle(unit) && entscheidung.tenantId !== unit.tenantId)
		throw new UnitError('Keine Person mit dieser E-Mail-Adresse in diesem Mandanten.');
	const r = await upsertEntraPerson({
		oid,
		email: entscheidung.email,
		displayName: gefunden.user.displayName?.trim() || entscheidung.email,
		givenName: gefunden.user.givenName?.trim() || null,
		tenantId: entscheidung.tenantId,
		roles: entscheidung.roles,
		vorab: true
	});
	if (!r.ok)
		throw new UnitError(
			r.reason === 'local_conflict'
				? 'Mit dieser E-Mail-Adresse gibt es schon ein lokales Konto.'
				: 'Dieses Konto ist gesperrt.'
		);
	if (r.created) {
		await seedFavorites(r.personId, entscheidung.tenantId);
		await audit({
			category: 'admin',
			action: 'person.entra_vorab',
			actorId: p.personId,
			tenantId: entscheidung.tenantId,
			entityType: 'person',
			entityId: r.personId,
			details: { unitId },
			ip
		});
	}
	return r.personId;
}
