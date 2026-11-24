/**
 * „Hub bearbeiten“ als eine Seite mit einem „Speichern“ (Entwurf der
 * Intranet-PWA): Laden aller Angaben und Übernehmen der Änderungen in einem
 * Schritt. Jede Teiländerung prüft die Rechte wie die Einzelaktionen.
 */
import { and, asc, eq, gte, inArray, ne, sql } from 'drizzle-orm';
import { addDays, berlinNow } from '../canteen.ts';
import { cleanLayout, HUB_GRENZEN, istLinkSymbol, linkAdresse, type HubLayout } from '../hubs.ts';
import { audit } from './audit.ts';
import type { Principal } from './auth/access.ts';
import { deleteEvent, eventWritableUnits, saveEvent } from './calendar.ts';
import { db } from './db/index.ts';
import {
	events,
	persons,
	unitContacts,
	unitDocumentFolders,
	unitDocuments,
	unitLinks,
	unitMembers,
	units
} from './db/schema.ts';
import { dokumenteHinzufuegen, dokumentLoeschen, teamAufgabe } from './hub-inhalte.ts';
import { dokumentePflegbar, HubError, manageable, setResting, updateHubPage } from './hubs.ts';
import { photosOf } from './people.ts';
import { addMember, removeMember, setMemberRights, teamFuerPflege, UnitError } from './units.ts';

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const ZEIT = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Alles, was „Hub bearbeiten“ braucht, das nicht schon in getHub steht. */
export async function hubPflegeDaten(p: Principal, unitId: string) {
	const heute = berlinNow().date;
	const [pflege, schreibbar, termine] = await Promise.all([
		teamFuerPflege(p, unitId),
		eventWritableUnits(p),
		db
			.select({
				id: events.id,
				date: events.date,
				title: events.title,
				allDay: events.allDay,
				startTime: events.startTime,
				place: events.place
			})
			.from(events)
			.where(and(eq(events.unitId, unitId), gte(events.date, heute)))
			.orderBy(asc(events.date), asc(events.startTime))
			.limit(50)
	]);
	const fotos = await photosOf(pflege.team.map((m) => m.personId));
	const abteilungen = pflege.team.length
		? await db
				.select({ personId: unitMembers.personId, name: units.name })
				.from(unitMembers)
				.innerJoin(units, eq(units.id, unitMembers.unitId))
				.where(
					and(
						inArray(
							unitMembers.personId,
							pflege.team.map((m) => m.personId)
						),
						eq(unitMembers.isPrimary, true),
						ne(units.type, 'hub')
					)
				)
		: [];
	return {
		...pflege,
		team: pflege.team.map((m) => ({
			...m,
			foto: fotos.get(m.personId) ?? null,
			abteilung: abteilungen.find((a) => a.personId === m.personId)?.name ?? null
		})),
		termine,
		darfTermine: schreibbar.some((u) => u.id === unitId),
		bisTermin: addDays(heute, 730)
	};
}

// ---------------------------------------------------------------------------
// Speichern
// ---------------------------------------------------------------------------

export interface HubDaten {
	kurz: string;
	koordination: string | null;
	hinweis: { an: boolean; text: string; bis: string };
	aufbau: HubLayout;
	ruhen: boolean;
	team: {
		personId: string;
		hubteam: boolean;
		aufgabe: string;
		news: boolean;
		faqs: boolean;
		termine: boolean;
		dokumente: boolean;
		mediathek: boolean;
		umfragen: boolean;
	}[];
	kontakte: { personId: string; aufgabe: string }[];
	links: { label: string; description: string; url: string; icon: string }[];
	dokumente: { id: string; title: string; ordner: string }[];
	termine: { id: string | null; date: string; title: string; startTime: string; place: string }[];
}

const s = (x: unknown, max: number) => (typeof x === 'string' ? x.slice(0, max) : '');
const b = (x: unknown) => x === true;

/** Eingabe aus dem Formular (JSON) lesen und auf bekannte Felder begrenzen */
export function hubDatenLesen(roh: string): HubDaten {
	let j: Record<string, unknown>;
	try {
		j = JSON.parse(roh) as Record<string, unknown>;
	} catch {
		throw new HubError('Die Angaben konnten nicht gelesen werden.');
	}
	const liste = (x: unknown, max: number) =>
		(Array.isArray(x) ? x : []).slice(0, max) as Record<string, unknown>[];
	const h = (j.hinweis ?? {}) as Record<string, unknown>;
	return {
		kurz: s(j.kurz, 1000),
		koordination: GUID.test(s(j.koordination, 40)) ? s(j.koordination, 40) : null,
		hinweis: { an: b(h.an), text: s(h.text, 1000), bis: s(h.bis, 20) },
		aufbau: cleanLayout(j.aufbau as Partial<HubLayout>),
		ruhen: b(j.ruhen),
		team: liste(j.team, 200).map((m) => ({
			personId: s(m.personId, 40),
			hubteam: b(m.hubteam),
			aufgabe: s(m.aufgabe, 500),
			news: b(m.news),
			faqs: b(m.faqs),
			termine: b(m.termine),
			dokumente: b(m.dokumente),
			mediathek: b(m.mediathek),
			umfragen: b(m.umfragen)
		})),
		kontakte: liste(j.kontakte, HUB_GRENZEN.ansprechpersonen).map((k) => ({
			personId: s(k.personId, 40),
			aufgabe: s(k.aufgabe, 500)
		})),
		links: liste(j.links, HUB_GRENZEN.links).map((l) => ({
			label: s(l.label, 500),
			description: s(l.description, 500),
			url: s(l.url, 2000),
			icon: s(l.icon, 40)
		})),
		dokumente: liste(j.dokumente, HUB_GRENZEN.dokumente).map((d) => ({
			id: s(d.id, 40),
			title: s(d.title, 500),
			ordner: s(d.ordner, 500)
		})),
		termine: liste(j.termine, 50).map((t) => ({
			id: GUID.test(s(t.id, 40)) ? s(t.id, 40) : null,
			date: s(t.date, 10),
			title: s(t.title, 200),
			startTime: s(t.startTime, 5),
			place: s(t.place, 200)
		}))
	};
}

/**
 * Alles übernehmen. Reihenfolge: Team (zuerst neue Hub-Team-Mitglieder, dann
 * Entzüge, zuletzt Entfernen, damit das Hub-Team nie leer wird), dann Seite
 * (Koordination braucht das neue Team), Ansprechpersonen, Links, Dokumente,
 * Termine, Ruhen.
 */
export async function hubSpeichern(
	p: Principal,
	unitId: string,
	d: HubDaten,
	aboutHtml: string,
	neueDateien: string[],
	ip: string
): Promise<{ fehler?: string }> {
	const u = await manageable(p, unitId);
	try {
		// Zuerst alles prüfen, was ohne Datenbank geht, damit nichts halb gespeichert wird
		// --- Schnellzugriff prüfen ---
		const links = d.links
			.filter((l) => l.label.trim() || l.url.trim())
			.map((l, i) => {
				const url = linkAdresse(l.url);
				const label = l.label.trim().slice(0, HUB_GRENZEN.linkTitel);
				if (!label) throw new HubError(`Schnellzugriff ${i + 1}: Bitte gib eine Bezeichnung ein.`);
				if (!url)
					throw new HubError(
						`Schnellzugriff „${label}“: Bitte wähl ein Ziel (Seite im Intranet, Dokument oder https://…).`
					);
				return {
					unitId,
					label,
					description: l.description.trim().slice(0, HUB_GRENZEN.linkBeschreibung) || null,
					url,
					icon: istLinkSymbol(l.icon) ? l.icon : 'link',
					position: i
				};
			});

		// --- Team und Rechte ---
		const vorher = await teamFuerPflege(p, unitId);
		const neu = d.team.filter((m) => GUID.test(m.personId));
		for (const m of neu)
			if (!vorher.team.some((v) => v.personId === m.personId))
				await addMember(p, unitId, m.personId, ip);
		const reihenfolge = [...neu].sort((a, z) => Number(z.hubteam) - Number(a.hubteam));
		for (const m of reihenfolge) {
			const v = vorher.team.find((x) => x.personId === m.personId);
			const geaendert =
				!v ||
				v.verwaltet !== (m.hubteam || v.ausEntra) ||
				v.mayWriteNews !== m.news ||
				v.mayWriteFaqs !== m.faqs ||
				v.mayWriteEvents !== m.termine ||
				v.mayWriteDocuments !== m.dokumente ||
				v.mayWriteMedia !== m.mediathek ||
				v.mayWriteSurveys !== m.umfragen;
			if (geaendert)
				await setMemberRights(
					p,
					unitId,
					m.personId,
					{
						isPrimary: false,
						mayWriteNews: m.news,
						mayWriteFaqs: m.faqs,
						mayWriteEvents: m.termine,
						mayWriteBehindScenes: false,
						mayWriteDocuments: m.dokumente,
						mayWriteMedia: m.mediathek,
						mayWriteSurveys: m.umfragen,
						verwaltet: m.hubteam || Boolean(v?.ausEntra)
					},
					ip
				);
			if ((v?.hubTask ?? '') !== m.aufgabe.trim())
				await teamAufgabe(p, unitId, m.personId, m.aufgabe);
		}
		for (const v of vorher.team)
			if (!neu.some((m) => m.personId === v.personId))
				await removeMember(p, unitId, v.personId, ip);

		// --- Seite ---
		const seite = await updateHubPage(p, unitId, {
			notice: d.hinweis.an ? d.hinweis.text : '',
			noticeUntil: d.hinweis.bis,
			about: d.kurz,
			aboutHtml,
			coordinator: d.koordination ?? '',
			layout: d.aufbau
		});
		if (seite.fehler) return seite;

		// --- Ansprechpersonen: Liste ersetzen ---
		const kontaktIds = [...new Set(d.kontakte.map((k) => k.personId).filter((x) => GUID.test(x)))];
		const erlaubt = kontaktIds.length
			? await db
					.select({ id: persons.id })
					.from(persons)
					.where(
						and(
							inArray(persons.id, kontaktIds),
							ne(persons.status, 'disabled'),
							eq(persons.hidden, false),
							u.isCentral ? undefined : eq(persons.tenantId, u.tenantId)
						)
					)
			: [];
		await db.transaction(async (tx) => {
			await tx.delete(unitContacts).where(eq(unitContacts.unitId, unitId));
			const zeilen = d.kontakte
				.filter((k) => erlaubt.some((e) => e.id === k.personId))
				.filter((k, i, a) => a.findIndex((x) => x.personId === k.personId) === i)
				.map((k, i) => ({
					unitId,
					personId: k.personId,
					task: k.aufgabe.trim().slice(0, HUB_GRENZEN.aufgabe),
					position: i
				}));
			if (zeilen.length) await tx.insert(unitContacts).values(zeilen);
		});

		// --- Schnellzugriff: Liste ersetzen ---
		await db.transaction(async (tx) => {
			await tx.delete(unitLinks).where(eq(unitLinks.unitId, unitId));
			if (links.length) await tx.insert(unitLinks).values(links);
		});

		// --- Dokumente ---
		await dokumenteSpeichern(p, unitId, d.dokumente, neueDateien);

		// --- Termine ---
		await termineSpeichern(p, unitId, u.isCentral, d.termine);

		// --- Ruhen ---
		if (Boolean(u.restingSince) !== d.ruhen) await setResting(p, unitId, d.ruhen, ip);
	} catch (err) {
		if (err instanceof HubError || err instanceof UnitError) return { fehler: err.message };
		throw err;
	}
	await audit({
		category: 'admin',
		action: 'hub.page_save',
		actorId: p.personId,
		tenantId: u.tenantId,
		entityType: 'unit',
		entityId: unitId,
		ip
	});
	return {};
}

/** Dokumente: entfernte löschen, Titel, Ordner (per Name) und Reihenfolge, neue anhängen */
export async function dokumenteSpeichern(
	p: Principal,
	unitId: string,
	liste: HubDaten['dokumente'],
	neueDateien: string[]
) {
	await dokumentePflegbar(p, unitId);
	const vorhanden = await db
		.select({ id: unitDocuments.id })
		.from(unitDocuments)
		.where(eq(unitDocuments.unitId, unitId));
	for (const v of vorhanden)
		if (!liste.some((d) => d.id === v.id)) await dokumentLoeschen(p, unitId, v.id);
	// Ordner nach Namen: fehlende anlegen, leere am Ende löschen
	const ordner = await db
		.select({ id: unitDocumentFolders.id, name: unitDocumentFolders.name })
		.from(unitDocumentFolders)
		.where(eq(unitDocumentFolders.unitId, unitId));
	const ordnerId = async (name: string) => {
		const n = name.trim().slice(0, HUB_GRENZEN.ordnerName);
		if (!n) return null;
		const da = ordner.find((o) => o.name.toLowerCase() === n.toLowerCase());
		if (da) return da.id;
		if (ordner.length >= HUB_GRENZEN.ordner)
			throw new HubError(`Höchstens ${HUB_GRENZEN.ordner} Ordner.`);
		const [o] = await db
			.insert(unitDocumentFolders)
			.values({ unitId, name: n, position: ordner.length })
			.returning({ id: unitDocumentFolders.id, name: unitDocumentFolders.name });
		ordner.push(o);
		return o.id;
	};
	for (const [i, dok] of liste.entries()) {
		if (!vorhanden.some((v) => v.id === dok.id)) continue;
		const title = dok.title.trim().slice(0, HUB_GRENZEN.dokumentTitel);
		if (!title) throw new HubError('Jedes Dokument braucht einen Titel.');
		await db
			.update(unitDocuments)
			.set({ title, folderId: await ordnerId(dok.ordner), position: i })
			.where(and(eq(unitDocuments.id, dok.id), eq(unitDocuments.unitId, unitId)));
	}
	if (neueDateien.length) await dokumenteHinzufuegen(p, unitId, neueDateien, null);
	await db
		.delete(unitDocumentFolders)
		.where(
			and(
				eq(unitDocumentFolders.unitId, unitId),
				sql`not exists (select 1 from unit_documents d where d.folder_id = ${unitDocumentFolders.id})`
			)
		);
}

async function termineSpeichern(
	p: Principal,
	unitId: string,
	zentral: boolean,
	liste: HubDaten['termine']
) {
	if (!(await eventWritableUnits(p)).some((u) => u.id === unitId)) return;
	const heute = berlinNow().date;
	const vorhanden = await db
		.select({ id: events.id })
		.from(events)
		.where(and(eq(events.unitId, unitId), gte(events.date, heute)));
	for (const v of vorhanden) if (!liste.some((t) => t.id === v.id)) await deleteEvent(p, v.id);
	for (const t of liste) {
		if (!t.title.trim() && !t.date) continue;
		if (!ISO.test(t.date)) throw new HubError(`Termin „${t.title}“: Bitte gib ein Datum an.`);
		if (t.id && !vorhanden.some((v) => v.id === t.id)) continue;
		const r = await saveEvent(p, t.id, {
			unitId,
			title: t.title,
			date: t.date,
			allDay: !ZEIT.test(t.startTime),
			startTime: ZEIT.test(t.startTime) ? t.startTime : '',
			endTime: '',
			place: t.place,
			description: '',
			allTenants: zentral,
			tenantIds: []
		});
		if (!r.ok)
			throw new HubError(
				`Termin „${t.title || t.date}“: ${Object.values(r.errors)[0] ?? 'Bitte prüf die Angaben.'}`
			);
	}
}
