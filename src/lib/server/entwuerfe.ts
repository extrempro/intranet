/**
 * Entwürfe speichern, laden, auflisten, löschen (Row-Level Security: nur die
 * eigene Person). Hochgeladene Bilder und Anhänge eines Entwurfs stehen in
 * draft_files und werden deshalb nicht nach 24 Stunden gelöscht.
 */
import { and, desc, eq, inArray, lt, sql } from 'drizzle-orm';
import { bildIdsImText } from '../bilder-im-text.ts';
import {
	ENTWURF_ARTEN,
	ENTWURF_TAGE,
	MAX_ENTWUERFE,
	MAX_ENTWURF_ZEICHEN,
	type EntwurfArt
} from '../entwuerfe.ts';
import { faqUnitIds, newsUnitIds, type Principal } from './auth/access.ts';
import { db, scoped } from './db/index.ts';
import { draftFiles, drafts, files } from './db/schema.ts';
import { cleanHtml } from './html.ts';

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class EntwurfFehler extends Error {}

/** Entwürfe nur für Personen, die in diesem Bereich schreiben dürfen */
export function darfEntwurf(p: Principal, art?: EntwurfArt): boolean {
	if (p.operatorLocationId) return false;
	const news = () => newsUnitIds(p).size > 0;
	const faq = () => faqUnitIds(p).size > 0;
	const kulissen = () => p.memberships.some((m) => m.mayWriteBehindScenes);
	if (art === 'news') return news();
	if (art === 'faq') return faq();
	if (art === 'kulissen') return kulissen();
	return news() || faq() || kulissen();
}

export const istEntwurfArt = (x: unknown): x is EntwurfArt =>
	ENTWURF_ARTEN.includes(x as EntwurfArt);

/** Felder aus dem Formular; Steuerfelder (entwurf, art) fallen weg. */
export function felderAusForm(form: FormData): [string, string][] {
	const felder: [string, string][] = [];
	for (const [k, v] of form) {
		if (k === 'entwurf' || k === 'art' || typeof v !== 'string') continue;
		felder.push([k.slice(0, 100), v]);
	}
	return felder;
}

export function alsFormData(felder: [string, string][]): FormData {
	const fd = new FormData();
	for (const [k, v] of felder) fd.append(k, v);
	return fd;
}

const titelAus = (felder: [string, string][]) =>
	(felder.find(([k]) => k === 'titel' || k === 'frage')?.[1] ?? '').trim().slice(0, 200);

/** Datei-IDs im Entwurf: Anhänge und Bilder im Text */
function dateiIds(felder: [string, string][]): string[] {
	const ids = new Set<string>();
	for (const [k, v] of felder) {
		if (k === 'anhaenge' && GUID.test(v)) ids.add(v.toLowerCase());
		if (k === 'text' || k === 'antwort') for (const id of bildIdsImText(v)) ids.add(id);
	}
	return [...ids].slice(0, 100);
}

/** Speichern (neu oder vorhandener eigener Entwurf). Liefert die ID. */
export async function entwurfSpeichern(
	p: Principal,
	art: EntwurfArt,
	id: string | null,
	felder: [string, string][]
): Promise<string> {
	const zeichen = felder.reduce((n, [k, v]) => n + k.length + v.length, 0);
	if (zeichen > MAX_ENTWURF_ZEICHEN) throw new EntwurfFehler('Der Entwurf ist zu groß.');
	// Nur eigene Uploads gehören zum Entwurf
	const kandidaten = dateiIds(felder);
	const eigene = kandidaten.length
		? (
				await db
					.select({ id: files.id })
					.from(files)
					.where(and(inArray(files.id, kandidaten), eq(files.createdBy, p.personId)))
			).map((r) => r.id)
		: [];
	return scoped(p, async (tx) => {
		let entwurfId = id && GUID.test(id) ? id : null;
		if (entwurfId) {
			const r = await tx
				.update(drafts)
				.set({ fields: felder, title: titelAus(felder), updatedAt: new Date() })
				.where(and(eq(drafts.id, entwurfId), eq(drafts.art, art)))
				.returning({ id: drafts.id });
			if (!r.length) entwurfId = null;
		}
		if (!entwurfId) {
			const [{ n }] = await tx
				.select({ n: sql<number>`count(*)::int` })
				.from(drafts)
				.where(eq(drafts.personId, p.personId));
			if (n >= MAX_ENTWUERFE)
				throw new EntwurfFehler(
					`Du hast schon ${MAX_ENTWUERFE} Entwürfe. Bitte lösche alte unter „Meine Entwürfe“.`
				);
			[{ id: entwurfId }] = await tx
				.insert(drafts)
				.values({ personId: p.personId, art, fields: felder, title: titelAus(felder) })
				.returning({ id: drafts.id });
		}
		await tx.delete(draftFiles).where(eq(draftFiles.draftId, entwurfId));
		if (eigene.length)
			await tx.insert(draftFiles).values(eigene.map((fileId) => ({ draftId: entwurfId!, fileId })));
		return entwurfId;
	});
}

/** Eigenen Entwurf laden (nur passende Art) */
export async function entwurfLaden(p: Principal, id: string | null, art: EntwurfArt) {
	if (!id || !GUID.test(id)) return null;
	const [r] = await scoped(p, (tx) =>
		tx
			.select({ id: drafts.id, fields: drafts.fields, updatedAt: drafts.updatedAt })
			.from(drafts)
			.where(and(eq(drafts.id, id), eq(drafts.art, art)))
	);
	if (!r) return null;
	// Text wie beim Veröffentlichen bereinigen, bevor er in den Editor geht
	const felder = r.fields.map(([k, v]): [string, string] =>
		k === 'text' || k === 'antwort'
			? [k, cleanHtml(v, { bilder: new Set(bildIdsImText(v)), erweitert: true })]
			: [k, v]
	);
	return { id: r.id, form: alsFormData(felder), gespeichert: r.updatedAt };
}

export async function entwuerfeListe(p: Principal, art?: EntwurfArt) {
	return scoped(p, (tx) =>
		tx
			.select({
				id: drafts.id,
				art: drafts.art,
				title: drafts.title,
				updatedAt: drafts.updatedAt
			})
			.from(drafts)
			.where(art ? eq(drafts.art, art) : undefined)
			.orderBy(desc(drafts.updatedAt))
	);
}

/** Löschen, z. B. nach dem Veröffentlichen. Fremde IDs bewirken nichts. */
export async function entwurfLoeschen(p: Principal, id: string | null | undefined) {
	if (!id || !GUID.test(id)) return;
	await scoped(p, (tx) => tx.delete(drafts).where(eq(drafts.id, id)));
}

/** Aufräumen: lange nicht geänderte Entwürfe löschen */
export async function alteEntwuerfeLoeschen() {
	await db
		.delete(drafts)
		.where(lt(drafts.updatedAt, sql`now() - make_interval(days => ${ENTWURF_TAGE})`));
}
