/**
 * FAQs je Einheit (Kap. 8.9). Lesen über scoped(): Row-Level Security zeigt
 * nur FAQs von Einheiten, die die Person sehen darf. Geschrieben wird nach
 * Rechteprüfung (Schreibrecht „FAQs“) mit der Besitzer-Rolle.
 */
import { and, asc, eq, ilike, inArray, or, sql } from 'drizzle-orm';
import { unitTypeLabel } from '../roles.ts';
import { canWriteFaqs, faqUnitIds, type Principal } from './auth/access.ts';
import { db, scoped } from './db/index.ts';
import { faqAttachments, faqs, files, units } from './db/schema.ts';
import { deleteStored, MAX_ATTACHMENTS, ownUnlinkedFiles } from './files/store.ts';
import { cleanHtml, htmlToText } from './html.ts';

export class FaqError extends Error {}

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface FaqUnit {
	id: string;
	name: string;
	label: string;
}

/** Einheiten, für die die Person FAQs pflegen darf. */
export async function faqWritableUnits(p: Principal): Promise<FaqUnit[]> {
	const ids = [...faqUnitIds(p)];
	if (ids.length === 0) return [];
	const rows = await db.select().from(units).where(inArray(units.id, ids)).orderBy(asc(units.name));
	return rows
		.filter((u) => canWriteFaqs(p, u))
		.map((u) => ({ id: u.id, name: u.name, label: unitTypeLabel(u) }));
}

export interface FaqItem {
	id: string;
	question: string;
	answerHtml: string;
	attachments: { id: string; name: string; size: number; kind: string }[];
	canEdit: boolean;
}

/** Alle sichtbaren FAQs, nach Einheit gruppiert; optional gefiltert. */
export async function listFaqs(p: Principal, opts: { unitId?: string | null; q?: string | null }) {
	const q = opts.q?.trim().slice(0, 100) ?? '';
	const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
	const unitId = opts.unitId && GUID.test(opts.unitId) ? opts.unitId : null;
	const writable = new Set((await faqWritableUnits(p)).map((u) => u.id));

	const { rows, unitsWithFaqs } = await scoped(p, async (tx) => {
		const rows = await tx
			.select({
				id: faqs.id,
				question: faqs.question,
				answerHtml: faqs.answerHtml,
				unitId: units.id,
				unitName: units.name,
				unitType: units.type,
				unitTitle: units.title
			})
			.from(faqs)
			.innerJoin(units, eq(units.id, faqs.unitId))
			.where(
				and(
					unitId ? eq(faqs.unitId, unitId) : undefined,
					q ? or(ilike(faqs.question, like), ilike(faqs.answerText, like)) : undefined
				)
			)
			.orderBy(asc(units.name), asc(faqs.position), asc(faqs.createdAt));
		// Für den Filter: alle Einheiten mit FAQs (ohne Such- und Einheitsfilter)
		const unitsWithFaqs = await tx
			.selectDistinct({ id: units.id, name: units.name })
			.from(faqs)
			.innerJoin(units, eq(units.id, faqs.unitId))
			.orderBy(asc(units.name));
		return { rows, unitsWithFaqs };
	});
	// Dateien liest die App-Rolle nicht; die FAQs oben sind bereits geprüft.
	const ids = rows.map((r) => r.id);
	const atts = ids.length
		? await db
				.select({
					faqId: faqAttachments.faqId,
					id: files.id,
					name: files.name,
					size: files.size,
					kind: files.kind
				})
				.from(faqAttachments)
				.innerJoin(files, eq(files.id, faqAttachments.fileId))
				.where(inArray(faqAttachments.faqId, ids))
				.orderBy(asc(faqAttachments.position))
		: [];

	const groups: (FaqUnit & { items: FaqItem[] })[] = [];
	for (const r of rows) {
		let g = groups.find((x) => x.id === r.unitId);
		if (!g) {
			g = {
				id: r.unitId,
				name: r.unitName,
				label: unitTypeLabel({ type: r.unitType, title: r.unitTitle }),
				items: []
			};
			groups.push(g);
		}
		g.items.push({
			id: r.id,
			question: r.question,
			answerHtml: r.answerHtml,
			attachments: atts
				.filter((a) => a.faqId === r.id)
				.map(({ id, name, size, kind }) => ({ id, name, size, kind })),
			canEdit: writable.has(r.unitId)
		});
	}
	return { groups, units: unitsWithFaqs, canWrite: writable.size > 0, q, unitId };
}

/** FAQ zum Bearbeiten, nur mit Schreibrecht für die Einheit. */
export async function faqForEdit(p: Principal, id: string) {
	if (!GUID.test(id)) return null;
	const [row] = await db.select().from(faqs).where(eq(faqs.id, id));
	if (!row) return null;
	const writable = await faqWritableUnits(p);
	if (!writable.some((u) => u.id === row.unitId)) return null;
	const attachments = await db
		.select({ id: files.id, name: files.name, size: files.size, kind: files.kind })
		.from(faqAttachments)
		.innerJoin(files, eq(files.id, faqAttachments.fileId))
		.where(eq(faqAttachments.faqId, id))
		.orderBy(asc(faqAttachments.position));
	return { ...row, attachments };
}

export interface FaqInput {
	unitId: string;
	question: string;
	answerHtml: string;
	attachmentIds: string[];
}

export type FaqErrors = Partial<Record<'unitId' | 'question' | 'answer' | 'attachments', string>>;

export function checkFaq(input: { question: string; answerText: string }): FaqErrors {
	const e: FaqErrors = {};
	const q = input.question.trim();
	if (q.length < 5) e.question = 'Formuliere die Frage bitte etwas ausführlicher.';
	else if (q.length > 200) e.question = 'Die Frage darf höchstens 200 Zeichen haben.';
	if (!input.answerText) e.answer = 'Gib bitte eine Antwort ein.';
	else if (input.answerText.length > 20000) e.answer = 'Die Antwort ist zu lang.';
	return e;
}

/** Anlegen (id leer) oder ändern. Liefert die ID oder Fehler je Feld. */
export async function saveFaq(
	p: Principal,
	id: string | null,
	input: FaqInput
): Promise<{ ok: true; id: string } | { ok: false; errors: FaqErrors }> {
	const writable = await faqWritableUnits(p);
	const existing = id ? await faqForEdit(p, id) : null;
	if (id && !existing)
		throw new FaqError('Diese FAQ gibt es nicht oder du darfst sie nicht ändern.');
	const errors: FaqErrors = {};
	if (!writable.some((u) => u.id === input.unitId))
		errors.unitId = 'Für diese Einheit darfst du keine FAQs pflegen.';

	const answerHtml = cleanHtml(input.answerHtml);
	const answerText = htmlToText(answerHtml);
	Object.assign(errors, checkFaq({ question: input.question, answerText }));

	// Anhänge: vorhandene dieser FAQ oder eigene, noch nicht verknüpfte Uploads
	const wanted = [...new Set(input.attachmentIds.filter((x) => GUID.test(x)))];
	const current = existing?.attachments.map((a) => a.id) ?? [];
	if (wanted.length > MAX_ATTACHMENTS)
		errors.attachments = `Höchstens ${MAX_ATTACHMENTS} Anhänge je FAQ.`;
	const fresh = wanted.filter((x) => !current.includes(x));
	if (fresh.length && (await ownUnlinkedFiles(p.personId, fresh)).length !== fresh.length)
		errors.attachments = 'Ein Anhang ist nicht mehr verfügbar. Lade ihn bitte erneut hoch.';
	if (Object.keys(errors).length) return { ok: false, errors };

	const removed = current.filter((x) => !wanted.includes(x));
	const values = {
		unitId: input.unitId,
		question: input.question.trim(),
		answerHtml,
		answerText,
		updatedBy: p.personId
	};
	const faqId = await db.transaction(async (tx) => {
		let faqIdInner = id;
		if (faqIdInner) {
			await tx.update(faqs).set(values).where(eq(faqs.id, faqIdInner));
		} else {
			const [{ max }] = await tx
				.select({ max: sql<number>`coalesce(max(${faqs.position}), -1)::int` })
				.from(faqs)
				.where(eq(faqs.unitId, input.unitId));
			const [row] = await tx
				.insert(faqs)
				.values({ ...values, position: max + 1 })
				.returning({ id: faqs.id });
			faqIdInner = row.id;
		}
		await tx.delete(faqAttachments).where(eq(faqAttachments.faqId, faqIdInner));
		if (wanted.length)
			await tx
				.insert(faqAttachments)
				.values(wanted.map((fileId, position) => ({ faqId: faqIdInner!, fileId, position })));
		return faqIdInner;
	});
	await deleteStored(removed);
	return { ok: true, id: faqId };
}

export async function deleteFaq(p: Principal, id: string) {
	const existing = await faqForEdit(p, id);
	if (!existing) throw new FaqError('Diese FAQ gibt es nicht oder du darfst sie nicht löschen.');
	await db.delete(faqs).where(eq(faqs.id, id));
	await deleteStored(existing.attachments.map((a) => a.id));
	return existing.unitId;
}

/** Innerhalb der Einheit um eine Stelle nach oben (−1) oder unten (+1). */
export async function moveFaq(p: Principal, id: string, delta: -1 | 1) {
	const existing = await faqForEdit(p, id);
	if (!existing) throw new FaqError('Diese FAQ gibt es nicht oder du darfst sie nicht ändern.');
	await db.transaction(async (tx) => {
		const list = await tx
			.select({ id: faqs.id })
			.from(faqs)
			.where(eq(faqs.unitId, existing.unitId))
			.orderBy(asc(faqs.position), asc(faqs.createdAt));
		const i = list.findIndex((f) => f.id === id);
		const j = i + delta;
		if (i < 0 || j < 0 || j >= list.length) return;
		[list[i], list[j]] = [list[j], list[i]];
		for (const [position, f] of list.entries())
			await tx.update(faqs).set({ position }).where(eq(faqs.id, f.id));
	});
}

/** Für den Download: Gehört die Datei zu einer sichtbaren FAQ? */
export async function faqOfFile(p: Principal, fileId: string): Promise<boolean> {
	if (!GUID.test(fileId)) return false;
	const rows = await scoped(p, (tx) =>
		tx
			.select({ faqId: faqAttachments.faqId })
			.from(faqAttachments)
			.where(eq(faqAttachments.fileId, fileId))
	);
	return rows.length > 0;
}

/** Angaben zu Anhängen für das erneute Anzeigen des Formulars. */
export async function describeFaqAttachments(p: Principal, ids: string[], faqId: string | null) {
	const valid = ids.filter((x) => GUID.test(x));
	if (!valid.length) return [];
	const current = faqId ? ((await faqForEdit(p, faqId))?.attachments.map((a) => a.id) ?? []) : [];
	const own = await ownUnlinkedFiles(
		p.personId,
		valid.filter((x) => !current.includes(x))
	);
	const allowed = valid.filter((x) => current.includes(x) || own.includes(x));
	if (!allowed.length) return [];
	const rows = await db
		.select({ id: files.id, name: files.name, size: files.size, kind: files.kind })
		.from(files)
		.where(inArray(files.id, allowed));
	return allowed.map((x) => rows.find((r) => r.id === x)!).filter(Boolean);
}
