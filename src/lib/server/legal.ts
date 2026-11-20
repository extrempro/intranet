/**
 * Rechtliches (Kap. 8.10): Betriebs- und Dienstvereinbarungen sowie
 * Gesetze und Tarifverträge, jeweils je Mandant. Lesen: Personen des
 * Mandanten. Pflegen: Rolle „Vereinbarungen pflegen“ für den Mandanten.
 */
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { matchesSearch } from '../departments.ts';
import {
	AGREEMENT_KINDS,
	validateAgreement,
	validateLegalLink,
	type AgreementErrors,
	type AgreementInput,
	type LegalLinkErrors,
	type LegalLinkInput
} from '../legal.ts';
import { hasTenantRole, type Principal } from './auth/access.ts';
import { db } from './db/index.ts';
import { agreementAttachments, agreements, files, legalLinks, tenants } from './db/schema.ts';
import { deleteStored, MAX_ATTACHMENTS, ownUnlinkedFiles } from './files/store.ts';
import { notify, personsOfTenants } from './notify.ts';

export class LegalError extends Error {}

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function mayMaintain(p: Principal, tenantId: string): boolean {
	return hasTenantRole(p, 'vereinbarungen_pflegen', tenantId);
}

/** Mandanten, deren Rechtliches die Person pflegen darf. */
export async function maintainableTenants(p: Principal) {
	const rows = await db
		.select({ id: tenants.id, name: tenants.name, short: tenants.shortName })
		.from(tenants)
		.orderBy(asc(tenants.name));
	return rows.filter((t) => mayMaintain(p, t.id));
}

/** Lesen: eigener Mandant; zum Pflegen auch weitere Mandanten mit der Rolle. */
function mayRead(p: Principal, tenantId: string) {
	return tenantId === p.tenantId || mayMaintain(p, tenantId);
}

async function attachmentsOf(ids: string[]) {
	if (!ids.length) return [];
	return db
		.select({
			agreementId: agreementAttachments.agreementId,
			id: files.id,
			name: files.name,
			size: files.size,
			kind: files.kind
		})
		.from(agreementAttachments)
		.innerJoin(files, eq(files.id, agreementAttachments.fileId))
		.where(inArray(agreementAttachments.agreementId, ids))
		.orderBy(asc(agreementAttachments.position));
}

export async function listLegal(p: Principal, tenantId = p.tenantId) {
	if (!GUID.test(tenantId) || !mayRead(p, tenantId)) tenantId = p.tenantId;
	const [rows, links] = await Promise.all([
		db
			.select()
			.from(agreements)
			.where(eq(agreements.tenantId, tenantId))
			.orderBy(asc(agreements.title)),
		db
			.select({
				id: legalLinks.id,
				kind: legalLinks.kind,
				title: legalLinks.title,
				description: legalLinks.description,
				url: legalLinks.url,
				fileId: legalLinks.fileId,
				fileName: files.name,
				fileSize: files.size
			})
			.from(legalLinks)
			.leftJoin(files, eq(files.id, legalLinks.fileId))
			.where(eq(legalLinks.tenantId, tenantId))
			.orderBy(asc(legalLinks.position), asc(legalLinks.createdAt))
	]);
	const atts = await attachmentsOf(rows.map((r) => r.id));
	return {
		tenantId,
		canWrite: mayMaintain(p, tenantId),
		vereinbarungen: rows.map((r) => ({
			id: r.id,
			kind: r.kind,
			title: r.title,
			description: r.description,
			versionDate: r.versionDate,
			validFrom: r.validFrom,
			attachments: atts
				.filter((a) => a.agreementId === r.id)
				.map(({ id, name, size, kind }) => ({ id, name, size, kind }))
		})),
		links
	};
}

export async function getAgreement(p: Principal, id: string) {
	if (!GUID.test(id)) return null;
	const [r] = await db.select().from(agreements).where(eq(agreements.id, id));
	if (!r || !mayRead(p, r.tenantId)) return null;
	const atts = await attachmentsOf([r.id]);
	return {
		...r,
		canWrite: mayMaintain(p, r.tenantId),
		attachments: atts.map(({ id, name, size, kind }) => ({ id, name, size, kind }))
	};
}

// ---------------------------------------------------------------------------
// Vereinbarungen pflegen
// ---------------------------------------------------------------------------

export async function saveAgreement(
	p: Principal,
	id: string | null,
	tenantId: string,
	input: AgreementInput,
	attachmentIds: string[],
	announce: boolean
): Promise<{ ok: true; id: string } | { ok: false; errors: AgreementErrors }> {
	const existing = id ? await getAgreement(p, id) : null;
	if (id && (!existing || !existing.canWrite))
		throw new LegalError('Diese Vereinbarung gibt es nicht oder du darfst sie nicht ändern.');
	if (existing) tenantId = existing.tenantId;
	const errors = validateAgreement(input);
	if (!GUID.test(tenantId) || !mayMaintain(p, tenantId))
		errors.tenantId = 'Für diesen Mandanten darfst du keine Vereinbarungen einstellen.';

	const wanted = [...new Set(attachmentIds.filter((x) => GUID.test(x)))];
	const current = existing?.attachments.map((a) => a.id) ?? [];
	if (wanted.length === 0) errors.attachments = 'Bitte lade mindestens ein Dokument hoch.';
	if (wanted.length > MAX_ATTACHMENTS)
		errors.attachments = `Höchstens ${MAX_ATTACHMENTS} Anhänge je Vereinbarung.`;
	const fresh = wanted.filter((x) => !current.includes(x));
	if (fresh.length && (await ownUnlinkedFiles(p.personId, fresh)).length !== fresh.length)
		errors.attachments = 'Ein Anhang ist nicht mehr verfügbar. Lade ihn bitte erneut hoch.';
	if (Object.keys(errors).length) return { ok: false, errors };

	const values = {
		tenantId,
		kind: input.kind as 'betrieb' | 'dienst',
		title: input.title.trim(),
		description: input.description.trim() || null,
		versionDate: input.versionDate,
		validFrom: input.validFrom,
		updatedBy: p.personId,
		updatedAt: new Date()
	};
	const agreementId = await db.transaction(async (tx) => {
		let aid = id;
		if (aid) await tx.update(agreements).set(values).where(eq(agreements.id, aid));
		else aid = (await tx.insert(agreements).values(values).returning({ id: agreements.id }))[0].id;
		await tx.delete(agreementAttachments).where(eq(agreementAttachments.agreementId, aid));
		await tx
			.insert(agreementAttachments)
			.values(wanted.map((fileId, position) => ({ agreementId: aid!, fileId, position })));
		return aid;
	});
	// Frühere Fassungen werden nicht aufbewahrt (Kap. 8.10, 15)
	await deleteStored(current.filter((x) => !wanted.includes(x)));

	if (!id || announce) {
		const art = AGREEMENT_KINDS.find((k) => k.key === values.kind)!.single;
		const gilt = new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeZone: 'UTC' }).format(
			new Date(`${values.validFrom}T12:00:00Z`)
		);
		await notify('vereinbarungen', await personsOfTenants([tenantId]), {
			title: `${id ? 'Neue Fassung' : `Neue ${art}`}: ${values.title}`,
			detail: `Gilt ab ${gilt}`,
			link: `/rechtliches/${agreementId}`
		});
	}
	return { ok: true, id: agreementId };
}

export async function deleteAgreement(p: Principal, id: string) {
	const existing = await getAgreement(p, id);
	if (!existing?.canWrite)
		throw new LegalError('Diese Vereinbarung gibt es nicht oder du darfst sie nicht löschen.');
	await db.delete(agreements).where(eq(agreements.id, id));
	await deleteStored(existing.attachments.map((a) => a.id));
	return existing.tenantId;
}

/** Angaben zu Anhängen für das erneute Anzeigen des Formulars. */
export async function describeAttachments(p: Principal, ids: string[], agreementId: string | null) {
	const valid = ids.filter((x) => GUID.test(x));
	if (!valid.length) return [];
	const current = agreementId
		? ((await getAgreement(p, agreementId))?.attachments.map((a) => a.id) ?? [])
		: [];
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

// ---------------------------------------------------------------------------
// Gesetze und Tarifverträge
// ---------------------------------------------------------------------------

async function ownLink(p: Principal, id: string) {
	if (!GUID.test(id)) throw new LegalError('Eintrag nicht gefunden.');
	const [r] = await db.select().from(legalLinks).where(eq(legalLinks.id, id));
	if (!r || !mayMaintain(p, r.tenantId)) throw new LegalError('Eintrag nicht gefunden.');
	return r;
}

export async function saveLegalLink(
	p: Principal,
	id: string | null,
	tenantId: string,
	input: LegalLinkInput,
	fileId: string | null
): Promise<{ ok: true } | { ok: false; errors: LegalLinkErrors }> {
	const existing = id ? await ownLink(p, id) : null;
	if (existing) tenantId = existing.tenantId;
	// Datei: vorhandene behalten, neue eigene übernehmen oder entfernen (null)
	let keepFile: string | null = null;
	const errors: LegalLinkErrors = {};
	if (fileId && fileId === existing?.fileId) keepFile = fileId;
	else if (fileId) {
		if (!GUID.test(fileId) || (await ownUnlinkedFiles(p.personId, [fileId])).length !== 1)
			errors.file = 'Die Datei ist nicht mehr verfügbar. Lade sie bitte erneut hoch.';
		else keepFile = fileId;
	}
	Object.assign(errors, validateLegalLink(input, Boolean(keepFile)));
	if (!GUID.test(tenantId) || !mayMaintain(p, tenantId))
		errors.kind = 'Für diesen Mandanten darfst du nichts eintragen.';
	if (Object.keys(errors).length) return { ok: false, errors };
	const values = {
		tenantId,
		kind: input.kind as 'gesetz' | 'tarif',
		title: input.title.trim(),
		description: input.description.trim() || null,
		url: input.url.trim() || null,
		fileId: keepFile,
		updatedAt: new Date()
	};
	if (existing) {
		await db.update(legalLinks).set(values).where(eq(legalLinks.id, existing.id));
		if (existing.fileId && existing.fileId !== keepFile) await deleteStored([existing.fileId]);
	} else {
		const [{ max }] = await db
			.select({ max: sql<number>`coalesce(max(${legalLinks.position}), -1)::int` })
			.from(legalLinks)
			.where(and(eq(legalLinks.tenantId, tenantId), eq(legalLinks.kind, values.kind)));
		await db.insert(legalLinks).values({ ...values, position: max + 1 });
	}
	return { ok: true };
}

export async function deleteLegalLink(p: Principal, id: string) {
	const r = await ownLink(p, id);
	await db.delete(legalLinks).where(eq(legalLinks.id, r.id));
	if (r.fileId) await deleteStored([r.fileId]);
}

export async function moveLegalLink(p: Principal, id: string, delta: -1 | 1) {
	const r = await ownLink(p, id);
	await db.transaction(async (tx) => {
		const list = await tx
			.select({ id: legalLinks.id })
			.from(legalLinks)
			.where(and(eq(legalLinks.tenantId, r.tenantId), eq(legalLinks.kind, r.kind)))
			.orderBy(asc(legalLinks.position), asc(legalLinks.createdAt));
		const i = list.findIndex((x) => x.id === id);
		const j = i + delta;
		if (i < 0 || j < 0 || j >= list.length) return;
		[list[i], list[j]] = [list[j], list[i]];
		for (const [position, x] of list.entries())
			await tx.update(legalLinks).set({ position }).where(eq(legalLinks.id, x.id));
	});
}

// ---------------------------------------------------------------------------
// Dateien und Suche
// ---------------------------------------------------------------------------

/** Download: Datei gehört zu Rechtlichem eines lesbaren Mandanten. */
export async function legalFileAllowed(p: Principal, fileId: string): Promise<boolean> {
	if (!GUID.test(fileId)) return false;
	const [a, l] = await Promise.all([
		db
			.select({ tenantId: agreements.tenantId })
			.from(agreementAttachments)
			.innerJoin(agreements, eq(agreements.id, agreementAttachments.agreementId))
			.where(eq(agreementAttachments.fileId, fileId)),
		db
			.select({ tenantId: legalLinks.tenantId })
			.from(legalLinks)
			.where(eq(legalLinks.fileId, fileId))
	]);
	return [...a, ...l].some((r) => mayRead(p, r.tenantId));
}

/** Globale Suche: Vereinbarungen, Gesetze und Tarifverträge des eigenen Mandanten. */
export async function searchLegal(p: Principal, text: string, limit = 20) {
	const [rows, links] = await Promise.all([
		db
			.select({
				id: agreements.id,
				kind: agreements.kind,
				title: agreements.title,
				description: agreements.description,
				validFrom: agreements.validFrom
			})
			.from(agreements)
			.where(eq(agreements.tenantId, p.tenantId)),
		db
			.select({
				id: legalLinks.id,
				kind: legalLinks.kind,
				title: legalLinks.title,
				description: legalLinks.description
			})
			.from(legalLinks)
			.where(eq(legalLinks.tenantId, p.tenantId))
	]);
	return {
		vereinbarungen: rows
			.filter((r) => matchesSearch(text, [r.title, r.description]))
			.slice(0, limit),
		links: links.filter((r) => matchesSearch(text, [r.title, r.description])).slice(0, limit)
	};
}
