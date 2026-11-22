/**
 * Gemeinsame Themenliste für Mediathek und FAQs (Kap. 8.15). Pflegen dürfen
 * nur System-Admins; vorschlagen darf, wer Videos oder FAQs pflegt.
 */
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { db } from './db/index.ts';
import {
	faqTopics,
	persons,
	roleAssignments,
	topics,
	topicSuggestions,
	videoTopics
} from './db/schema.ts';
import { notify } from './notify.ts';

export class ThemaFehler extends Error {}

const MAX_LAENGE = 60;
const MAX_THEMEN = 200;

export function themaName(raw: unknown): string {
	const n = String(raw ?? '')
		.replace(/\s+/g, ' ')
		.trim();
	if (!n) throw new ThemaFehler('Gib einen Namen ein.');
	if (n.length > MAX_LAENGE) throw new ThemaFehler(`Höchstens ${MAX_LAENGE} Zeichen.`);
	return n;
}

export async function alleThemen() {
	return db
		.select({ id: topics.id, name: topics.name })
		.from(topics)
		.orderBy(asc(sql`lower(${topics.name})`));
}

/** Themen mit Anzahl Videos und FAQs (für die Verwaltung) */
export async function themenMitAnzahl() {
	return db
		.select({
			id: topics.id,
			name: topics.name,
			videos: sql<number>`(select count(*)::int from video_topics vt where vt.topic_id = ${topics.id})`,
			faqs: sql<number>`(select count(*)::int from faq_topics ft where ft.topic_id = ${topics.id})`
		})
		.from(topics)
		.orderBy(asc(sql`lower(${topics.name})`));
}

async function gibtEs(name: string, ohne?: string) {
	const [t] = await db
		.select({ id: topics.id })
		.from(topics)
		.where(
			and(
				sql`lower(${topics.name}) = lower(${name})`,
				ohne ? sql`${topics.id} <> ${ohne}` : undefined
			)
		);
	return Boolean(t);
}

export async function themaAnlegen(raw: unknown) {
	const name = themaName(raw);
	if (await gibtEs(name)) throw new ThemaFehler('Dieses Thema gibt es schon.');
	const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(topics);
	if (n >= MAX_THEMEN) throw new ThemaFehler(`Höchstens ${MAX_THEMEN} Themen.`);
	const [t] = await db.insert(topics).values({ name }).returning({ id: topics.id });
	return { id: t.id, name };
}

export async function themaUmbenennen(id: string, raw: unknown) {
	const name = themaName(raw);
	if (await gibtEs(name, id)) throw new ThemaFehler('Dieses Thema gibt es schon.');
	const r = await db
		.update(topics)
		.set({ name })
		.where(eq(topics.id, id))
		.returning({ id: topics.id });
	if (!r.length) throw new ThemaFehler('Thema nicht gefunden.');
	return name;
}

/** Löschen: verschwindet aus allen Videos und FAQs (Fremdschlüssel mit cascade) */
export async function themaLoeschen(id: string) {
	const r = await db.delete(topics).where(eq(topics.id, id)).returning({ name: topics.name });
	if (!r.length) throw new ThemaFehler('Thema nicht gefunden.');
	return r[0].name;
}

/** Nur gültige Themen-IDs übernehmen */
export async function gueltigeThemen(ids: string[]): Promise<string[]> {
	const sauber = [...new Set(ids.filter((i) => /^[0-9a-f-]{36}$/i.test(i)))].slice(0, 20);
	if (!sauber.length) return [];
	return (await db.select({ id: topics.id }).from(topics).where(inArray(topics.id, sauber))).map(
		(t) => t.id
	);
}

export async function themenSetzen(art: 'video' | 'faq', id: string, themen: string[]) {
	const ids = await gueltigeThemen(themen);
	if (art === 'video') {
		await db.delete(videoTopics).where(eq(videoTopics.videoId, id));
		if (ids.length)
			await db.insert(videoTopics).values(ids.map((topicId) => ({ videoId: id, topicId })));
	} else {
		await db.delete(faqTopics).where(eq(faqTopics.faqId, id));
		if (ids.length)
			await db.insert(faqTopics).values(ids.map((topicId) => ({ faqId: id, topicId })));
	}
}

// ---------------------------------------------------------------------------
// Vorschläge
// ---------------------------------------------------------------------------

export async function vorschlagen(personId: string, raw: unknown) {
	const name = themaName(raw);
	if (await gibtEs(name))
		throw new ThemaFehler('Dieses Thema gibt es schon. Du kannst es direkt auswählen.');
	const [{ n }] = await db
		.select({ n: sql<number>`count(*)::int` })
		.from(topicSuggestions)
		.where(eq(topicSuggestions.suggestedBy, personId));
	if (n >= 10) throw new ThemaFehler('Du hast schon 10 offene Vorschläge.');
	await db.insert(topicSuggestions).values({ name, suggestedBy: personId });
	const admins = (
		await db
			.selectDistinct({ id: roleAssignments.personId })
			.from(roleAssignments)
			.where(eq(roleAssignments.role, 'system_admin'))
	).map((r) => r.id);
	await notify('system', admins, {
		title: `Neuer Themenvorschlag: ${name}`,
		detail: 'Themen der Mediathek und FAQs',
		link: '/verwaltung/themen'
	});
	return name;
}

export async function vorschlaege() {
	return db
		.select({
			id: topicSuggestions.id,
			name: topicSuggestions.name,
			von: persons.displayName,
			at: topicSuggestions.createdAt
		})
		.from(topicSuggestions)
		.leftJoin(persons, eq(persons.id, topicSuggestions.suggestedBy))
		.orderBy(asc(topicSuggestions.createdAt));
}

export async function vorschlagEntscheiden(id: string, annehmen: boolean) {
	const [v] = await db.delete(topicSuggestions).where(eq(topicSuggestions.id, id)).returning();
	if (!v) throw new ThemaFehler('Vorschlag nicht gefunden.');
	if (annehmen && !(await gibtEs(v.name))) await db.insert(topics).values({ name: v.name });
	if (v.suggestedBy)
		await notify('nachrichten', [v.suggestedBy], {
			title: annehmen
				? `Dein Themenvorschlag „${v.name}“ ist aufgenommen.`
				: `Dein Themenvorschlag „${v.name}“ wurde nicht aufgenommen.`,
			detail: 'Themen der Mediathek und FAQs',
			link: '/mediathek'
		});
	return v.name;
}
