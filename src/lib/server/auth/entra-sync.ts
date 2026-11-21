/**
 * Nächtlicher Abgleich mit Entra (Kap. 4.1): Profil, Mandant und Rollen aller
 * Entra-Konten; in Entra gelöschte, deaktivierte oder aus der Zugangsgruppe
 * entfernte Konten werden gesperrt. Von Entra gesperrte Konten gibt der
 * Abgleich wieder frei, sobald sie in Entra wieder gültig sind; von der
 * Verwaltung gesperrte Konten bleiben gesperrt (sie werden nicht abgefragt).
 *
 * Läuft einmal am Tag ab ENTRA_SYNC_TIME (Standard 02:30, Europe/Berlin) und
 * von Hand unter Verwaltung → System. Braucht die Anwendungsberechtigungen
 * User.Read.All und GroupMember.Read.All.
 */
import { and, eq, inArray, isNotNull, or } from 'drizzle-orm';
import { berlinNow } from '../../canteen.ts';
import { audit } from '../audit.ts';
import { db } from '../db/index.ts';
import { persons, roleAssignments } from '../db/schema.ts';
import { removePhoto } from '../people.ts';
import { getSetting, setSetting } from '../settings.ts';
import { endAllSessions } from './session.ts';
import { getEntraConfig, GraphError, graphAppGet } from './entra.ts';
import { loadLoginContext, replaceEntraRoles } from './entra-persist.ts';
import {
	planPerson,
	rolleSchluessel,
	SPERR_GRUENDE,
	zuVieleSperren,
	type GraphUser,
	type Lookup,
	type SyncAction,
	type SyncPerson
} from './entra-sync-plan.ts';

export interface GraphClient {
	lookup(oid: string): Promise<Lookup>;
}

export interface SyncStatus {
	zeit: string;
	ok: boolean;
	ausgeloest: 'zeitplan' | 'hand';
	dauerMs: number;
	geprueft: number;
	aktualisiert: number;
	rollen: number;
	gesperrt: number;
	freigegeben: number;
	fehler: number;
	meldung: string;
	/** Angehalten, weil zu viele Sperren anstanden */
	angehalten?: { sperren: number; aktiv: number };
}

export const STATUS_KEY = 'entra.abgleich';
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const BERECHTIGUNG_FEHLT =
	'Graph verweigert den Zugriff. Erteile in der App-Registrierung die Anwendungsberechtigungen User.Read.All und GroupMember.Read.All mit Administratorzustimmung.';

/** Standard-Client: Graph mit Anwendungsberechtigungen. */
export const graphClient: GraphClient = {
	async lookup(oid) {
		if (!GUID.test(oid)) return null;
		const user = await graphAppGet<GraphUser>(
			`/users/${oid}?$select=id,displayName,mail,userPrincipalName,accountEnabled`
		);
		if (!user) return null;
		const groupIds: string[] = [];
		let url: string | undefined =
			`/users/${oid}/transitiveMemberOf/microsoft.graph.group?$select=id&$top=999`;
		for (let page = 0; url && page < 50; page++) {
			const body: { value: { id: string }[]; '@odata.nextLink'?: string } | null =
				await graphAppGet(url);
			if (!body) break;
			groupIds.push(...body.value.map((g) => g.id));
			url = body['@odata.nextLink'];
		}
		return { user, groupIds };
	}
};

async function loadPersons(): Promise<SyncPerson[]> {
	const rows = await db
		.select({
			id: persons.id,
			oid: persons.entraOid,
			email: persons.email,
			displayName: persons.displayName,
			tenantId: persons.tenantId,
			status: persons.status,
			disabledBy: persons.disabledBy
		})
		.from(persons)
		.where(
			and(
				eq(persons.authSource, 'entra'),
				isNotNull(persons.entraOid),
				or(
					inArray(persons.status, ['active', 'invited']),
					and(eq(persons.status, 'disabled'), eq(persons.disabledBy, 'entra'))
				)
			)
		);
	const roles = rows.length
		? await db
				.select({
					personId: roleAssignments.personId,
					role: roleAssignments.role,
					scope: roleAssignments.scope,
					scopeTenantId: roleAssignments.scopeTenantId,
					scopeUnitId: roleAssignments.scopeUnitId
				})
				.from(roleAssignments)
				.where(eq(roleAssignments.source, 'entra'))
		: [];
	const byPerson = new Map<string, string[]>();
	for (const r of roles) {
		const list = byPerson.get(r.personId) ?? [];
		list.push(rolleSchluessel(r));
		byPerson.set(r.personId, list);
	}
	return rows.map((r) => ({
		...r,
		oid: r.oid as string,
		entraRoles: byPerson.get(r.id) ?? []
	}));
}

/** Mehrere Abfragen gleichzeitig, aber schonend für die Drosselung von Graph. */
async function parallel<T, R>(items: T[], n: number, fn: (item: T) => Promise<R>): Promise<R[]> {
	const out: R[] = new Array(items.length);
	let next = 0;
	const worker = async () => {
		while (next < items.length) {
			const i = next++;
			out[i] = await fn(items[i]);
		}
	};
	await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker));
	return out;
}

async function apply(a: SyncAction): Promise<'aktualisiert' | 'gesperrt' | 'nichts'> {
	const p = a.person;
	if (a.art === 'bleibt_gesperrt') return 'nichts';
	if (a.art === 'sperren') {
		await db
			.update(persons)
			.set({ status: 'disabled', disabledAt: new Date(), disabledBy: 'entra' })
			.where(eq(persons.id, p.id));
		await endAllSessions(p.id);
		await removePhoto(p.id);
		await audit({
			category: 'admin',
			action: 'person.disable',
			tenantId: p.tenantId,
			entityType: 'person',
			entityId: p.id,
			details: { quelle: 'entra', grund: SPERR_GRUENDE[a.grund] }
		});
		return 'gesperrt';
	}
	if (!a.geaendert && !a.rollenGeaendert && !a.freigeben) return 'nichts';
	await db.transaction(async (tx) => {
		await tx
			.update(persons)
			.set({
				email: a.email,
				displayName: a.displayName,
				tenantId: a.tenantId,
				...(a.freigeben ? { status: 'active' as const, disabledAt: null, disabledBy: null } : {})
			})
			.where(eq(persons.id, p.id));
		if (a.rollenGeaendert || a.freigeben) await replaceEntraRoles(tx, p.id, a.roles);
	});
	if (a.freigeben)
		await audit({
			category: 'admin',
			action: 'person.enable',
			tenantId: a.tenantId,
			entityType: 'person',
			entityId: p.id,
			details: { quelle: 'entra' }
		});
	return 'aktualisiert';
}

let laeuft = false;

export function syncRunning(): boolean {
	return laeuft;
}

export async function runEntraSync(
	opts: { graph?: GraphClient; ausgeloest?: 'zeitplan' | 'hand'; trotzdem?: boolean } = {}
): Promise<SyncStatus | null> {
	if (laeuft) throw new Error('Der Abgleich läuft gerade.');
	const entra = await getEntraConfig();
	if (!entra && !opts.graph) return null;
	laeuft = true;
	const start = Date.now();
	const status: SyncStatus = {
		zeit: new Date().toISOString(),
		ok: true,
		ausgeloest: opts.ausgeloest ?? 'zeitplan',
		dauerMs: 0,
		geprueft: 0,
		aktualisiert: 0,
		rollen: 0,
		gesperrt: 0,
		freigegeben: 0,
		fehler: 0,
		meldung: ''
	};
	try {
		const graph = opts.graph ?? graphClient;
		const ctx = await loadLoginContext();
		const accessGroupId = entra?.accessGroupId ?? null;
		if (!accessGroupId)
			throw new Error('Keine Zugangsgruppe eingerichtet (ENTRA_ACCESS_GROUP_ID).');
		const liste = await loadPersons();

		// Graph abfragen; Rechtefehler brechen sofort ab, andere zählen je Person
		let rechte = false;
		const lookups = await parallel(liste, 4, async (person) => {
			if (rechte) return { ok: false as const };
			try {
				return { ok: true as const, lookup: await graph.lookup(person.oid) };
			} catch (err) {
				if (err instanceof GraphError && (err.status === 401 || err.status === 403)) rechte = true;
				else console.error('Entra-Abgleich: Abfrage fehlgeschlagen', err);
				return { ok: false as const };
			}
		});
		if (rechte) throw new Error(BERECHTIGUNG_FEHLT);

		const actions: SyncAction[] = [];
		liste.forEach((person, i) => {
			const l = lookups[i];
			if (!l.ok) status.fehler++;
			else
				actions.push(
					planPerson(person, l.lookup, {
						accessGroupId,
						domains: ctx.domains,
						mappings: ctx.mappings
					})
				);
		});
		status.geprueft = actions.length;
		if (liste.length > 0 && actions.length === 0) throw new Error('Graph war nicht erreichbar.');

		const zuViele = zuVieleSperren(actions);
		if (zuViele && !opts.trotzdem) {
			status.ok = false;
			status.angehalten = zuViele;
			status.meldung = `Angehalten: Der Abgleich würde ${zuViele.sperren} von ${zuViele.aktiv} Konten sperren. Prüfe die Zugangsgruppe und die Domains; wenn das stimmt, starte ihn von Hand mit „Trotzdem abgleichen“.`;
			return status;
		}

		for (const a of actions) {
			try {
				const r = await apply(a);
				if (r === 'gesperrt') status.gesperrt++;
				if (r === 'aktualisiert' && a.art === 'abgleichen') {
					if (a.freigeben) status.freigegeben++;
					else if (a.geaendert) status.aktualisiert++;
					if (a.rollenGeaendert) status.rollen++;
				}
			} catch (err) {
				// z. B. E-Mail-Adresse schon bei einem anderen Konto
				console.error('Entra-Abgleich: Person nicht übernommen', a.person.id, err);
				status.fehler++;
			}
		}
		if (status.fehler > 0)
			status.meldung = `${status.fehler} ${status.fehler === 1 ? 'Konto' : 'Konten'} konnten nicht abgeglichen werden (siehe Protokoll des Containers).`;
		return status;
	} catch (err) {
		status.ok = false;
		status.meldung = err instanceof Error ? err.message.slice(0, 300) : 'Unbekannter Fehler';
		return status;
	} finally {
		status.dauerMs = Date.now() - start;
		laeuft = false;
		await setSetting(STATUS_KEY, status, null);
		await audit({
			category: 'admin',
			action: 'entra.sync',
			details: {
				ok: status.ok,
				ausgeloest: status.ausgeloest,
				geprueft: status.geprueft,
				aktualisiert: status.aktualisiert,
				rollen: status.rollen,
				gesperrt: status.gesperrt,
				freigegeben: status.freigegeben,
				fehler: status.fehler
			}
		});
	}
}

export function syncTime(): string {
	const t = process.env.ENTRA_SYNC_TIME?.trim() ?? '';
	return /^([01]\d|2[0-3]):[0-5]\d$/.test(t) ? t : '02:30';
}

export async function lastSync(): Promise<SyncStatus | null> {
	return getSetting<SyncStatus | null>(STATUS_KEY, null);
}

let timer: ReturnType<typeof setInterval> | null = null;

/**
 * Prüft jede Minute: einmal je Kalendertag (Berlin) ab der Uhrzeit. Lief der
 * Server zur Uhrzeit nicht, holt er den Abgleich nach dem Start nach. Nach
 * einem Fehler versucht er es stündlich erneut.
 */
export function startEntraSync(intervalMs = 60_000) {
	if (timer) return;
	const tick = async () => {
		if (laeuft) return;
		const jetzt = berlinNow();
		if (jetzt.time < syncTime()) return;
		const letzter = await lastSync();
		if (letzter && berlinNow(new Date(letzter.zeit)).date === jetzt.date) {
			// Erfolgreich oder wegen zu vieler Sperren angehalten: erst morgen wieder.
			// Sonst (z. B. Graph nicht erreichbar) stündlich erneut versuchen.
			if (letzter.ok || letzter.angehalten) return;
			if (Date.now() - new Date(letzter.zeit).getTime() < 3_600_000) return;
		}
		if (!(await getEntraConfig())) return;
		const s = await runEntraSync({ ausgeloest: 'zeitplan' });
		if (s && !s.ok) {
			const { notifySystemAdmins } = await import('../system.ts');
			await notifySystemAdmins(`Entra-Abgleich: ${s.meldung}`);
		}
	};
	timer = setInterval(() => {
		tick().catch((err) => console.error('Entra-Abgleich fehlgeschlagen:', err));
	}, intervalMs);
	timer.unref();
}
