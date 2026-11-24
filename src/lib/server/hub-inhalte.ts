/**
 * Inhalte einer Hub-Seite (Kap. 8.12): Ansprechpersonen, Schnellzugriff,
 * Dokumente mit Ordnern, Titelbild und Symbol. Pflegen dürfen das Hub-Team,
 * die Redaktion (ohne Hub-Team) und die Verwaltung; Dokumente zusätzlich
 * Personen mit dem Recht „Dokumente“. Sichtbar ist alles wie der Hub selbst.
 */
import { and, asc, eq, inArray, isNull, max, sql } from 'drizzle-orm';
import { HUB_GRENZEN, istLinkSymbol, linkAdresse } from '../hubs.ts';
import { audit } from './audit.ts';
import type { Principal } from './auth/access.ts';
import { db } from './db/index.ts';
import {
	files,
	persons,
	roleAssignments,
	unitContacts,
	unitDocumentFolders,
	unitDocuments,
	unitLinks,
	unitMembers,
	units
} from './db/schema.ts';
import { JpegError, stripJpeg } from './files/jpeg.ts';
import { deleteStored, ownUnlinkedFiles, storeBytes } from './files/store.ts';
import { dokumentePflegbar, HubError, hubSichtbar, manageable, seitePflegbar } from './hubs.ts';
import { photosOf } from './people.ts';

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const id = (x: string, was = 'Eintrag') => {
	if (!GUID.test(x)) throw new HubError(`${was} nicht gefunden.`);
	return x;
};
/** Aktiv und nicht von der Verwaltung ausgeblendet */
const aktiv = sql`${persons.status} <> 'disabled' and ${persons.hidden} = false`;

// ---------------------------------------------------------------------------
// Laden für die Hub-Seite
// ---------------------------------------------------------------------------

export async function hubInhalte(unitId: string, koordination: string | null = null) {
	const [kontakte, team, links, ordner, dokumente] = await Promise.all([
		db
			.select({
				id: unitContacts.id,
				personId: persons.id,
				name: persons.displayName,
				email: persons.email,
				position: persons.position,
				phone: persons.phone,
				task: unitContacts.task
			})
			.from(unitContacts)
			.innerJoin(persons, eq(persons.id, unitContacts.personId))
			.where(and(eq(unitContacts.unitId, unitId), aktiv))
			.orderBy(asc(unitContacts.position), asc(persons.displayName)),
		db
			.selectDistinct({
				id: persons.id,
				name: persons.displayName,
				email: persons.email,
				position: persons.position,
				task: sql<string | null>`(select m.hub_task from unit_members m
					where m.unit_id = ${unitId} and m.person_id = ${persons.id})`,
				abteilung: sql<
					string | null
				>`(select u.name from unit_members m join units u on u.id = m.unit_id
					where m.person_id = ${persons.id} and m.is_primary and u.type <> 'hub' limit 1)`,
				abteilungSlug: sql<
					string | null
				>`(select u.slug from unit_members m join units u on u.id = m.unit_id
					where m.person_id = ${persons.id} and m.is_primary and u.type <> 'hub' limit 1)`
			})
			.from(roleAssignments)
			.innerJoin(persons, eq(persons.id, roleAssignments.personId))
			.where(
				and(eq(roleAssignments.role, 'hub_team'), eq(roleAssignments.scopeUnitId, unitId), aktiv)
			)
			.orderBy(asc(persons.displayName)),
		db
			.select({
				id: unitLinks.id,
				label: unitLinks.label,
				description: unitLinks.description,
				url: unitLinks.url,
				icon: unitLinks.icon
			})
			.from(unitLinks)
			.where(eq(unitLinks.unitId, unitId))
			.orderBy(asc(unitLinks.position)),
		db
			.select({ id: unitDocumentFolders.id, name: unitDocumentFolders.name })
			.from(unitDocumentFolders)
			.where(eq(unitDocumentFolders.unitId, unitId))
			.orderBy(asc(unitDocumentFolders.position), asc(unitDocumentFolders.name)),
		db
			.select({
				id: unitDocuments.id,
				folderId: unitDocuments.folderId,
				fileId: unitDocuments.fileId,
				title: unitDocuments.title,
				description: unitDocuments.description,
				name: files.name,
				size: files.size,
				kind: files.kind,
				updatedAt: unitDocuments.updatedAt
			})
			.from(unitDocuments)
			.innerJoin(files, eq(files.id, unitDocuments.fileId))
			.where(eq(unitDocuments.unitId, unitId))
			.orderBy(asc(unitDocuments.position), asc(unitDocuments.title))
	]);
	const fotos = await photosOf([...kontakte.map((k) => k.personId), ...team.map((t) => t.id)]);
	return {
		kontakte: kontakte.map((k) => ({ ...k, foto: fotos.get(k.personId) ?? null })),
		// Koordination zuerst
		team: team
			.map((t) => ({ ...t, foto: fotos.get(t.id) ?? null, koordination: t.id === koordination }))
			.sort((a, b) => Number(b.koordination) - Number(a.koordination)),
		teamAbteilungen: new Set(team.map((t) => t.abteilung).filter(Boolean)).size,
		links: links.map((l) => ({ ...l, extern: !l.url.startsWith('/') })),
		ordner,
		dokumente
	};
}

/** Darf die Person die Datei als Titelbild, Symbol oder Dokument eines Hubs sehen? */
export async function hubDateiErlaubt(p: Principal, fileId: string): Promise<boolean> {
	if (!GUID.test(fileId)) return false;
	const [bild] = await db
		.select({ id: units.id })
		.from(units)
		.where(
			and(
				eq(units.type, 'hub'),
				sql`(${units.coverFileId} = ${fileId} or ${units.iconFileId} = ${fileId})`
			)
		);
	const [dok] = bild
		? [null]
		: await db
				.select({ id: unitDocuments.unitId })
				.from(unitDocuments)
				.where(eq(unitDocuments.fileId, fileId));
	const unitId = bild?.id ?? dok?.id;
	return unitId ? hubSichtbar(p, unitId) : false;
}

async function protokoll(
	p: Principal,
	u: { id: string; tenantId: string },
	action: string,
	details: Record<string, unknown>,
	ip?: string
) {
	await audit({
		category: 'admin',
		action,
		actorId: p.personId,
		tenantId: u.tenantId,
		entityType: 'unit',
		entityId: u.id,
		details,
		ip
	});
}

/** Reihenfolge: Eintrag mit dem Nachbarn tauschen */
async function tauschen(
	tabelle: typeof unitContacts | typeof unitLinks | typeof unitDocumentFolders,
	unitId: string,
	eintrag: string,
	delta: -1 | 1
) {
	const liste = await db
		.select({ id: tabelle.id })
		.from(tabelle)
		.where(eq(tabelle.unitId, unitId))
		.orderBy(asc(tabelle.position), asc(tabelle.id));
	const i = liste.findIndex((x) => x.id === eintrag);
	const j = i + delta;
	if (i < 0 || j < 0 || j >= liste.length) return;
	[liste[i], liste[j]] = [liste[j], liste[i]];
	await db.transaction(async (tx) => {
		for (const [n, x] of liste.entries())
			await tx.update(tabelle).set({ position: n }).where(eq(tabelle.id, x.id));
	});
}

async function naechstePosition(
	tabelle: typeof unitContacts | typeof unitLinks | typeof unitDocumentFolders,
	unitId: string
) {
	const [r] = await db
		.select({ n: max(tabelle.position) })
		.from(tabelle)
		.where(eq(tabelle.unitId, unitId));
	return (r?.n ?? -1) + 1;
}

// ---------------------------------------------------------------------------
// Ansprechpersonen
// ---------------------------------------------------------------------------

export async function kontaktHinzufuegen(
	p: Principal,
	unitId: string,
	email: string,
	aufgabe: string
) {
	const u = await seitePflegbar(p, unitId);
	const [{ n }] = await db
		.select({ n: sql<number>`count(*)::int` })
		.from(unitContacts)
		.where(eq(unitContacts.unitId, u.id));
	if (n >= HUB_GRENZEN.ansprechpersonen)
		throw new HubError(`Höchstens ${HUB_GRENZEN.ansprechpersonen} Ansprechpersonen.`);
	const [person] = await db
		.select({ id: persons.id, tenantId: persons.tenantId })
		.from(persons)
		.where(
			and(
				sql`lower(${persons.email}) = lower(${email.trim()})`,
				aktiv,
				sql`not exists (select 1 from location_operators lo where lo.person_id = ${persons.id})`
			)
		);
	// Zentrale Hubs: alle Mandanten, sonst nur der Mandant des Hubs
	if (!person || (!u.isCentral && person.tenantId !== u.tenantId))
		throw new HubError('Keine Person mit dieser E-Mail-Adresse gefunden.');
	const r = await db
		.insert(unitContacts)
		.values({
			unitId: u.id,
			personId: person.id,
			task: aufgabe.trim().slice(0, HUB_GRENZEN.aufgabe),
			position: await naechstePosition(unitContacts, u.id)
		})
		.onConflictDoNothing()
		.returning({ id: unitContacts.id });
	if (!r.length) throw new HubError('Diese Person ist schon Ansprechperson.');
	await protokoll(p, u, 'hub.contact_add', { personId: person.id });
}

export async function kontaktAendern(
	p: Principal,
	unitId: string,
	eintrag: string,
	aufgabe: string
) {
	const u = await seitePflegbar(p, unitId);
	await db
		.update(unitContacts)
		.set({ task: aufgabe.trim().slice(0, HUB_GRENZEN.aufgabe) })
		.where(and(eq(unitContacts.id, id(eintrag)), eq(unitContacts.unitId, u.id)));
}

export async function kontaktEntfernen(p: Principal, unitId: string, eintrag: string) {
	const u = await seitePflegbar(p, unitId);
	await db
		.delete(unitContacts)
		.where(and(eq(unitContacts.id, id(eintrag)), eq(unitContacts.unitId, u.id)));
	await protokoll(p, u, 'hub.contact_remove', { id: eintrag });
}

export async function kontaktVerschieben(
	p: Principal,
	unitId: string,
	eintrag: string,
	delta: -1 | 1
) {
	const u = await seitePflegbar(p, unitId);
	await tauschen(unitContacts, u.id, id(eintrag), delta);
}

/** Aufgabe einer Person im Hub-Team (z. B. „Technik und Aufbau“) */
export async function teamAufgabe(p: Principal, unitId: string, personId: string, aufgabe: string) {
	const u = await seitePflegbar(p, unitId);
	await db
		.update(unitMembers)
		.set({ hubTask: aufgabe.trim().slice(0, HUB_GRENZEN.aufgabe) || null })
		.where(and(eq(unitMembers.unitId, u.id), eq(unitMembers.personId, id(personId, 'Person'))));
}

// ---------------------------------------------------------------------------
// Schnellzugriff
// ---------------------------------------------------------------------------

export interface LinkEingabe {
	label: string;
	description: string;
	url: string;
	icon: string;
}

function linkPruefen(l: LinkEingabe) {
	const label = l.label.trim().slice(0, HUB_GRENZEN.linkTitel);
	const url = linkAdresse(l.url);
	if (!label) throw new HubError('Bitte gib einen Titel für den Link ein.');
	if (!url)
		throw new HubError(
			'Die Adresse ist ungültig. Erlaubt sind https://…, mailto:…, tel:… oder ein Pfad im Intranet wie /faqs.'
		);
	return {
		label,
		description: l.description.trim().slice(0, HUB_GRENZEN.linkBeschreibung) || null,
		url,
		icon: istLinkSymbol(l.icon) ? l.icon : 'link'
	};
}

export async function linkHinzufuegen(p: Principal, unitId: string, l: LinkEingabe) {
	const u = await seitePflegbar(p, unitId);
	const werte = linkPruefen(l);
	const [{ n }] = await db
		.select({ n: sql<number>`count(*)::int` })
		.from(unitLinks)
		.where(eq(unitLinks.unitId, u.id));
	if (n >= HUB_GRENZEN.links) throw new HubError(`Höchstens ${HUB_GRENZEN.links} Links.`);
	await db
		.insert(unitLinks)
		.values({ unitId: u.id, ...werte, position: await naechstePosition(unitLinks, u.id) });
}

export async function linkAendern(p: Principal, unitId: string, eintrag: string, l: LinkEingabe) {
	const u = await seitePflegbar(p, unitId);
	await db
		.update(unitLinks)
		.set(linkPruefen(l))
		.where(and(eq(unitLinks.id, id(eintrag)), eq(unitLinks.unitId, u.id)));
}

export async function linkEntfernen(p: Principal, unitId: string, eintrag: string) {
	const u = await seitePflegbar(p, unitId);
	await db.delete(unitLinks).where(and(eq(unitLinks.id, id(eintrag)), eq(unitLinks.unitId, u.id)));
}

export async function linkVerschieben(
	p: Principal,
	unitId: string,
	eintrag: string,
	delta: -1 | 1
) {
	const u = await seitePflegbar(p, unitId);
	await tauschen(unitLinks, u.id, id(eintrag), delta);
}

// ---------------------------------------------------------------------------
// Dokumente und Ordner
// ---------------------------------------------------------------------------

async function ordnerDesHubs(unitId: string, ordner: string | null) {
	if (!ordner) return null;
	const [o] = await db
		.select({ id: unitDocumentFolders.id })
		.from(unitDocumentFolders)
		.where(
			and(eq(unitDocumentFolders.id, id(ordner, 'Ordner')), eq(unitDocumentFolders.unitId, unitId))
		);
	if (!o) throw new HubError('Ordner nicht gefunden.');
	return o.id;
}

export async function ordnerAnlegen(p: Principal, unitId: string, name: string) {
	const u = await dokumentePflegbar(p, unitId);
	const n = name.trim().slice(0, HUB_GRENZEN.ordnerName);
	if (!n) throw new HubError('Bitte gib einen Namen für den Ordner ein.');
	const [{ anzahl }] = await db
		.select({ anzahl: sql<number>`count(*)::int` })
		.from(unitDocumentFolders)
		.where(eq(unitDocumentFolders.unitId, u.id));
	if (anzahl >= HUB_GRENZEN.ordner) throw new HubError(`Höchstens ${HUB_GRENZEN.ordner} Ordner.`);
	await db.insert(unitDocumentFolders).values({
		unitId: u.id,
		name: n,
		position: await naechstePosition(unitDocumentFolders, u.id)
	});
}

export async function ordnerUmbenennen(p: Principal, unitId: string, ordner: string, name: string) {
	const u = await dokumentePflegbar(p, unitId);
	const n = name.trim().slice(0, HUB_GRENZEN.ordnerName);
	if (!n) throw new HubError('Bitte gib einen Namen für den Ordner ein.');
	await db
		.update(unitDocumentFolders)
		.set({ name: n })
		.where(
			and(eq(unitDocumentFolders.id, id(ordner, 'Ordner')), eq(unitDocumentFolders.unitId, u.id))
		);
}

/** Ordner löschen: Die Dokumente darin bleiben erhalten (ohne Ordner). */
export async function ordnerLoeschen(p: Principal, unitId: string, ordner: string) {
	const u = await dokumentePflegbar(p, unitId);
	await db
		.delete(unitDocumentFolders)
		.where(
			and(eq(unitDocumentFolders.id, id(ordner, 'Ordner')), eq(unitDocumentFolders.unitId, u.id))
		);
}

export async function ordnerVerschieben(
	p: Principal,
	unitId: string,
	ordner: string,
	delta: -1 | 1
) {
	const u = await dokumentePflegbar(p, unitId);
	await tauschen(unitDocumentFolders, u.id, id(ordner, 'Ordner'), delta);
}

/** Hochgeladene Dateien (eigene, noch nicht verknüpft) als Dokumente übernehmen. */
export async function dokumenteHinzufuegen(
	p: Principal,
	unitId: string,
	fileIds: string[],
	ordner: string | null
) {
	const u = await dokumentePflegbar(p, unitId);
	const folderId = await ordnerDesHubs(u.id, ordner);
	const eigene = await ownUnlinkedFiles(
		p.personId,
		fileIds.filter((x) => GUID.test(x)).slice(0, 20)
	);
	if (!eigene.length) throw new HubError('Bitte wähle mindestens eine Datei.');
	const [{ n }] = await db
		.select({ n: sql<number>`count(*)::int` })
		.from(unitDocuments)
		.where(eq(unitDocuments.unitId, u.id));
	if (n + eigene.length > HUB_GRENZEN.dokumente)
		throw new HubError(`Höchstens ${HUB_GRENZEN.dokumente} Dokumente je Hub.`);
	const namen = await db
		.select({ id: files.id, name: files.name, kind: files.kind })
		.from(files)
		.where(inArray(files.id, eigene));
	// Hochgeladen ist nur, was die Dateiablage erlaubt (PDF, Bilder, Office ohne Makros)
	const erlaubt = namen;
	const [{ pos }] = await db
		.select({ pos: max(unitDocuments.position) })
		.from(unitDocuments)
		.where(
			and(
				eq(unitDocuments.unitId, u.id),
				folderId ? eq(unitDocuments.folderId, folderId) : isNull(unitDocuments.folderId)
			)
		);
	await db.insert(unitDocuments).values(
		erlaubt.map((f, i) => ({
			unitId: u.id,
			folderId,
			fileId: f.id,
			title: f.name.replace(/\.[a-z0-9]{1,5}$/i, '').slice(0, HUB_GRENZEN.dokumentTitel),
			position: (pos ?? -1) + 1 + i,
			createdBy: p.personId
		}))
	);
	await protokoll(p, u, 'hub.documents_add', { count: erlaubt.length });
}

export async function dokumentAendern(
	p: Principal,
	unitId: string,
	eintrag: string,
	d: { title: string; description: string; ordner: string | null }
) {
	const u = await dokumentePflegbar(p, unitId);
	const title = d.title.trim().slice(0, HUB_GRENZEN.dokumentTitel);
	if (!title) throw new HubError('Bitte gib einen Titel ein.');
	const folderId = await ordnerDesHubs(u.id, d.ordner);
	await db
		.update(unitDocuments)
		.set({
			title,
			description: d.description.trim().slice(0, HUB_GRENZEN.dokumentBeschreibung) || null,
			folderId,
			updatedAt: new Date()
		})
		.where(and(eq(unitDocuments.id, id(eintrag, 'Dokument')), eq(unitDocuments.unitId, u.id)));
}

export async function dokumentLoeschen(p: Principal, unitId: string, eintrag: string) {
	const u = await dokumentePflegbar(p, unitId);
	const [d] = await db
		.delete(unitDocuments)
		.where(and(eq(unitDocuments.id, id(eintrag, 'Dokument')), eq(unitDocuments.unitId, u.id)))
		.returning({ fileId: unitDocuments.fileId, title: unitDocuments.title });
	if (!d) return;
	await deleteStored([d.fileId]);
	await protokoll(p, u, 'hub.document_delete', { title: d.title });
}

export async function dokumentVerschieben(
	p: Principal,
	unitId: string,
	eintrag: string,
	delta: -1 | 1
) {
	const u = await dokumentePflegbar(p, unitId);
	const [d] = await db
		.select({ folderId: unitDocuments.folderId })
		.from(unitDocuments)
		.where(and(eq(unitDocuments.id, id(eintrag, 'Dokument')), eq(unitDocuments.unitId, u.id)));
	if (!d) return;
	const liste = await db
		.select({ id: unitDocuments.id })
		.from(unitDocuments)
		.where(
			and(
				eq(unitDocuments.unitId, u.id),
				d.folderId ? eq(unitDocuments.folderId, d.folderId) : isNull(unitDocuments.folderId)
			)
		)
		.orderBy(asc(unitDocuments.position), asc(unitDocuments.title));
	const i = liste.findIndex((x) => x.id === eintrag);
	const j = i + delta;
	if (i < 0 || j < 0 || j >= liste.length) return;
	[liste[i], liste[j]] = [liste[j], liste[i]];
	await db.transaction(async (tx) => {
		for (const [n, x] of liste.entries())
			await tx.update(unitDocuments).set({ position: n }).where(eq(unitDocuments.id, x.id));
	});
}

// ---------------------------------------------------------------------------
// Titelbild und Symbol
// ---------------------------------------------------------------------------

export type HubBild = 'titelbild' | 'symbol';

/** Zuschnitt im Browser: Titelbild 4:1 (800–2400 px breit), Symbol quadratisch (128–512 px). */
export async function hubBildSetzen(
	p: Principal,
	unitId: string,
	art: HubBild,
	datei: unknown,
	ip: string
) {
	const u = await manageable(p, unitId);
	if (!(datei instanceof File) || datei.size === 0) throw new HubError('Bitte wähle ein Bild.');
	if (datei.size > 3 * 1024 * 1024) throw new HubError('Das Bild ist zu groß.');
	let sauber;
	try {
		sauber = stripJpeg(new Uint8Array(await datei.arrayBuffer()));
	} catch (err) {
		if (err instanceof JpegError) throw new HubError('Das Bild konnte nicht gelesen werden.');
		throw err;
	}
	const { width: w, height: h } = sauber;
	if (art === 'titelbild' && (w < 800 || w > 2400 || Math.abs(w / h - 4) > 0.05))
		throw new HubError('Das Titelbild muss im Format 4:1 sein (800 bis 2400 Pixel breit).');
	if (art === 'symbol' && (w !== h || w < 128 || w > 512))
		throw new HubError('Das Symbol muss quadratisch sein (128 bis 512 Pixel).');
	const neu = await storeBytes(sauber.data, `${art}.jpg`, 'jpeg', p.personId, 'bilder');
	const spalte = art === 'titelbild' ? 'coverFileId' : 'iconFileId';
	const alt = u[spalte];
	await db
		.update(units)
		.set({ [spalte]: neu.id })
		.where(eq(units.id, u.id));
	if (alt) await deleteStored([alt]);
	await protokoll(p, u, `hub.${art}_set`, {}, ip);
}

export async function hubBildEntfernen(p: Principal, unitId: string, art: HubBild, ip: string) {
	const u = await manageable(p, unitId);
	const spalte = art === 'titelbild' ? 'coverFileId' : 'iconFileId';
	const alt = u[spalte];
	if (!alt) return;
	await db
		.update(units)
		.set({ [spalte]: null })
		.where(eq(units.id, u.id));
	await deleteStored([alt]);
	await protokoll(p, u, `hub.${art}_remove`, {}, ip);
}
