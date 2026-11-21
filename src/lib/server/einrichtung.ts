/**
 * Einrichtung ohne Microsoft: Hauptmandant und erster System-Admin als lokales
 * Konto, über einen einmaligen Link aus dem Log der Anwendung.
 *
 * - Gibt es keinen aktiven System-Admin, legt jeder Start einen neuen Link an
 *   (24 Stunden gültig) und schreibt ihn ins Log. Den Link sieht nur, wer die
 *   Container-Logs lesen darf, also wer den Server verwaltet.
 * - Notfall: `node scripts/notfall-admin.mjs` im Container legt einen Link für
 *   einen weiteren lokalen System-Admin an (auch wenn es schon Admins gibt).
 *
 * Nach dem Anlegen der Person geht es mit der normalen Einladung weiter
 * (Passwort, zweiter Faktor, Wiederherstellungscodes).
 */
import { and, eq, sql } from 'drizzle-orm';
import { parseDomainList } from '../domain.ts';
import { tenantFromEmail } from '../tenant.ts';
import { HEX } from '../color.ts';
import { audit } from './audit.ts';
import { readInitialTenant } from './einrichtung-vorbelegung.ts';
import { randomToken, sha256Hex } from './crypto.ts';
import { db } from './db/index.ts';
import {
	invitations,
	localCredentials,
	persons,
	roleAssignments,
	settings,
	tenantDomains,
	tenants
} from './db/schema.ts';
import { seedFavorites } from './preferences.ts';
import { getSetting, setSetting } from './settings.ts';

export const EINRICHTUNG_KEY = 'einrichtung.link';
export const EINRICHTUNG_MS = 24 * 60 * 60_000;
const EINLADUNG_MS = 60 * 60_000;

export type Linkart = 'erst' | 'notfall';
interface GespeicherterLink {
	hash: string;
	bis: string;
	art: Linkart;
}

export class EinrichtungsFehler extends Error {}

/** Aktive Personen mit Rolle System-Admin */
export async function aktiveSystemAdmins(): Promise<number> {
	const [r] = await db
		.select({ n: sql<number>`count(distinct ${persons.id})::int` })
		.from(roleAssignments)
		.innerJoin(persons, eq(persons.id, roleAssignments.personId))
		.where(and(eq(roleAssignments.role, 'system_admin'), eq(persons.status, 'active')));
	return r?.n ?? 0;
}

export async function einrichtungNoetig(): Promise<boolean> {
	return (await aktiveSystemAdmins()) === 0;
}

/** Neuen Link speichern; gibt das Token zurück (steht nur im Link, gespeichert ist der Hash) */
export async function neuerLink(art: Linkart, jetzt = Date.now()): Promise<string> {
	const token = randomToken();
	const wert: GespeicherterLink = {
		hash: sha256Hex(token),
		bis: new Date(jetzt + EINRICHTUNG_MS).toISOString(),
		art
	};
	await setSetting(EINRICHTUNG_KEY, wert, null);
	return token;
}

/** Beim Start: ohne aktiven System-Admin einen neuen Einrichtungslink ins Log schreiben */
export async function einrichtungslinkBeimStart(origin: string | undefined) {
	if (!(await einrichtungNoetig())) return;
	const token = await neuerLink('erst');
	const link = new URL(`/einrichtung/${token}`, origin || 'http://localhost:3000').href;
	const linie = '='.repeat(72);
	console.warn(
		`\n${linie}\nDas Intranet ist noch nicht eingerichtet. Hauptmandant und ersten Admin anlegen:\n\n  ${link}\n\nDer Link gilt 24 Stunden und nur einmal. Ein Neustart erzeugt einen neuen.\n${linie}\n`
	);
}

/** Gültiger Link? Ein Erst-Link gilt nur, solange es keinen aktiven System-Admin gibt. */
export async function pruefeLink(token: string, jetzt = Date.now()): Promise<Linkart | null> {
	if (!token || token.length > 100) return null;
	const l = await getSetting<GespeicherterLink | null>(EINRICHTUNG_KEY, null);
	if (!l?.hash || l.hash !== sha256Hex(token) || Date.parse(l.bis) <= jetzt) return null;
	if (l.art === 'erst' && !(await einrichtungNoetig())) return null;
	return l.art;
}

export async function hatMandant(): Promise<boolean> {
	const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(tenants);
	return (r?.n ?? 0) > 0;
}

/** Vorbelegung aus INITIAL_TENANT_* (optional) */
export function vorbelegung() {
	try {
		const t = readInitialTenant(process.env);
		return {
			name: t?.name ?? '',
			kurz: t?.shortName ?? '',
			domains: t?.domains.join(', ') ?? '',
			akzent: t?.accent ?? '#0F6E56',
			akzentDunkel: t?.accentDark ?? '#5DCAA5'
		};
	} catch {
		return { name: '', kurz: '', domains: '', akzent: '#0F6E56', akzentDunkel: '#5DCAA5' };
	}
}

export interface MandantEingabe {
	name: string;
	kurz: string;
	domains: string;
	akzent: string;
	akzentDunkel: string;
}

/** Schritt 1: Hauptmandant (nur beim Erst-Link und solange es keinen Mandanten gibt) */
export async function hauptmandantAnlegen(token: string, e: MandantEingabe, ip: string) {
	if ((await pruefeLink(token)) !== 'erst')
		throw new EinrichtungsFehler('Dieser Link gilt nicht mehr.');
	const name = e.name.trim();
	const kurz = e.kurz.trim();
	if (name.length < 2 || name.length > 120)
		throw new EinrichtungsFehler('Der Name braucht 2 bis 120 Zeichen.');
	if (kurz.length < 1 || kurz.length > 10)
		throw new EinrichtungsFehler('Das Kürzel braucht 1 bis 10 Zeichen.');
	const { domains, invalid } = parseDomainList(e.domains);
	if (invalid.length) throw new EinrichtungsFehler(`Ungültige Domains: ${invalid.join(', ')}`);
	if (!domains.length) throw new EinrichtungsFehler('Bitte mindestens eine E-Mail-Domain angeben.');
	if (!HEX.test(e.akzent) || !HEX.test(e.akzentDunkel))
		throw new EinrichtungsFehler('Farben bitte als #RRGGBB angeben.');

	const id = await db.transaction(async (tx) => {
		// Sperre gegen doppeltes Absenden
		await tx.execute(sql`select pg_advisory_xact_lock(4711)`);
		const [{ n }] = await tx.select({ n: sql<number>`count(*)::int` }).from(tenants);
		if (n > 0) return null;
		const [row] = await tx
			.insert(tenants)
			.values({
				name,
				shortName: kurz,
				isMain: true,
				accentColor: e.akzent.toUpperCase(),
				accentColorDark: e.akzentDunkel.toUpperCase()
			})
			.returning({ id: tenants.id });
		await tx.insert(tenantDomains).values(domains.map((domain) => ({ domain, tenantId: row.id })));
		return row.id;
	});
	if (!id) throw new EinrichtungsFehler('Den Hauptmandanten gibt es schon.');
	await audit({
		category: 'admin',
		action: 'tenant.bootstrap',
		tenantId: id,
		entityType: 'tenant',
		entityId: id,
		details: { domains, einrichtung: true },
		ip
	});
	return id;
}

/**
 * Schritt 2: System-Admin als lokales Konto anlegen und eine Einladung
 * ausstellen (1 Stunde gültig). Verbraucht den Einrichtungslink.
 * Gibt das Einladungs-Token zurück; weiter unter /einladung/<Token>.
 */
export async function systemAdminAnlegen(
	token: string,
	e: { name: string; email: string },
	ip: string
): Promise<string> {
	const art = await pruefeLink(token);
	if (!art) throw new EinrichtungsFehler('Dieser Link gilt nicht mehr.');
	const name = e.name.trim();
	const email = e.email.trim();
	if (name.length < 2 || name.length > 120)
		throw new EinrichtungsFehler('Der Name braucht 2 bis 120 Zeichen.');
	if (!/^[^\s@]+@[^\s@]+$/.test(email) || email.length > 320)
		throw new EinrichtungsFehler('Bitte eine gültige E-Mail-Adresse angeben.');
	const domains = Object.fromEntries(
		(await db.select().from(tenantDomains)).map((d) => [d.domain, d.tenantId])
	);
	const tenantId = tenantFromEmail(email, domains);
	if (!tenantId)
		throw new EinrichtungsFehler(
			'Die E-Mail-Adresse passt zu keiner Domain eines Mandanten. Nimm eine Adresse mit einer der eingetragenen Domains.'
		);

	const [existing] = await db
		.select()
		.from(persons)
		.where(sql`lower(${persons.email}) = lower(${email})`);
	// Eine abgebrochene Einrichtung (noch nicht angenommen) darf wieder aufgenommen werden
	if (existing && !(existing.authSource === 'local' && existing.status === 'invited'))
		throw new EinrichtungsFehler(
			'Diese E-Mail-Adresse gibt es schon. Für einen Notfallzugang nimm eine eigene Adresse, z. B. it-notfall@….'
		);

	const einladung = randomToken();
	const personId = await db.transaction(async (tx) => {
		let id = existing?.id;
		if (!id) {
			const [row] = await tx
				.insert(persons)
				.values({ tenantId, email, displayName: name, authSource: 'local', status: 'invited' })
				.returning({ id: persons.id });
			id = row.id;
			await tx.insert(localCredentials).values({ personId: id });
		}
		const [hat] = await tx
			.select({ id: roleAssignments.id })
			.from(roleAssignments)
			.where(and(eq(roleAssignments.personId, id), eq(roleAssignments.role, 'system_admin')));
		if (!hat)
			await tx.insert(roleAssignments).values({ personId: id, role: 'system_admin', scope: 'all' });
		await tx.delete(invitations).where(eq(invitations.personId, id));
		await tx.insert(invitations).values({
			tokenHash: sha256Hex(einladung),
			personId: id,
			expiresAt: new Date(Date.now() + EINLADUNG_MS)
		});
		await tx.delete(settings).where(eq(settings.key, EINRICHTUNG_KEY));
		return id;
	});
	if (!existing) await seedFavorites(personId, tenantId);
	await audit({
		category: 'security',
		action: art === 'erst' ? 'setup.first_admin' : 'setup.emergency_admin',
		tenantId,
		entityType: 'person',
		entityId: personId,
		ip
	});
	return einladung;
}
