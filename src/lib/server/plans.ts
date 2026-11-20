/**
 * Pläne des KBB (Kap. 8.6) und Organigramm (Kap. 3.3).
 * Lesen: alle Angemeldeten (Pläne anderer KBBs ausdrücklich auch).
 * Pflegen: Fachpflege des jeweiligen KBB bzw. Rolle „Organigramm pflegen“.
 * Protokolliert werden nur Hochladen und Löschen.
 */
import { and, asc, desc, eq, gte, inArray, isNotNull, lt, sql } from 'drizzle-orm';
import { validatePlan, type PlanInput } from '../plans.ts';
import { audit } from './audit.ts';
import { hasUnitRole, type Principal } from './auth/access.ts';
import { db } from './db/index.ts';
import { files, orgChart, persons, plans, tenants, units } from './db/schema.ts';
import { deleteStored, FileError, storePdf } from './files/store.ts';
import { notify, personsOfTenants } from './notify.ts';
import { getSetting } from './settings.ts';

export class PlanError extends Error {}

/** Heute in Berlin als YYYY-MM-DD. */
export function todayBerlin(now = new Date()): string {
	return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(now);
}

export function canMaintainPlans(p: Principal, unitId: string): boolean {
	return hasUnitRole(p, 'fachpflege', unitId);
}

export function canMaintainOrgChart(p: Principal): boolean {
	return p.roles.some((r) => r.role === 'organigramm_pflegen');
}

/** Alle KBBs (je Mandant eines), der eigene Mandant zuerst. */
export async function kbbList(p: Principal) {
	const rows = await db
		.select({
			unitId: units.id,
			unitName: units.name,
			tenantId: tenants.id,
			tenantName: tenants.name
		})
		.from(tenants)
		.innerJoin(units, eq(units.id, tenants.kbbUnitId))
		.where(isNotNull(tenants.kbbUnitId))
		.orderBy(asc(tenants.name));
	return rows
		.map((r) => ({
			...r,
			eigener: r.tenantId === p.tenantId,
			darfPflegen: canMaintainPlans(p, r.unitId)
		}))
		.sort((a, b) => Number(b.eigener) - Number(a.eigener));
}

async function requireKbb(unitId: string) {
	if (!/^[0-9a-f-]{36}$/i.test(unitId)) throw new PlanError('KBB nicht gefunden.');
	const [kbb] = await db
		.select({
			unitId: units.id,
			unitName: units.name,
			tenantId: tenants.id,
			tenantName: tenants.name
		})
		.from(tenants)
		.innerJoin(units, eq(units.id, tenants.kbbUnitId))
		.where(eq(units.id, unitId));
	if (!kbb) throw new PlanError('KBB nicht gefunden.');
	return kbb;
}

const planColumns = {
	id: plans.id,
	unitId: plans.unitId,
	title: plans.title,
	validFrom: plans.validFrom,
	validUntil: plans.validUntil,
	fileId: plans.fileId,
	size: files.size,
	updatedAt: plans.updatedAt
};

export async function listPlans(unitId: string) {
	return db
		.select(planColumns)
		.from(plans)
		.innerJoin(files, eq(files.id, plans.fileId))
		.where(eq(plans.unitId, unitId))
		.orderBy(desc(plans.validFrom), asc(plans.title));
}

export async function getPlan(p: Principal, id: string) {
	if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
	const [plan] = await db
		.select({ ...planColumns, uploadedBy: persons.displayName })
		.from(plans)
		.innerJoin(files, eq(files.id, plans.fileId))
		.leftJoin(persons, eq(persons.id, plans.uploadedBy))
		.where(eq(plans.id, id));
	if (!plan) return null;
	const kbb = await requireKbb(plan.unitId);
	const same = await db
		.select({ id: plans.id, title: plans.title, validFrom: plans.validFrom })
		.from(plans)
		.where(eq(plans.unitId, plan.unitId))
		.orderBy(asc(plans.validFrom), asc(plans.title));
	const i = same.findIndex((x) => x.id === id);
	return {
		...plan,
		kbb,
		darfPflegen: canMaintainPlans(p, plan.unitId),
		vorher: i > 0 ? same[i - 1] : null,
		nachher: i < same.length - 1 ? same[i + 1] : null,
		// Neuerer Plan: beginnt später als dieser
		neuer: same.find((x) => x.validFrom > plan.validFrom) ?? null
	};
}

/** Startseite: aktuelle und kommende Pläne des eigenen KBB. */
export async function latestPlans(p: Principal, limit = 3) {
	const [t] = await db
		.select({ kbb: tenants.kbbUnitId })
		.from(tenants)
		.where(eq(tenants.id, p.tenantId));
	if (!t?.kbb) return [];
	return db
		.select({
			id: plans.id,
			title: plans.title,
			validFrom: plans.validFrom,
			validUntil: plans.validUntil
		})
		.from(plans)
		.where(and(eq(plans.unitId, t.kbb), gte(plans.validUntil, todayBerlin())))
		.orderBy(asc(plans.validFrom))
		.limit(limit);
}

function checkInput(input: PlanInput) {
	const errors = validatePlan(input);
	const first = Object.values(errors)[0];
	if (first) throw new PlanError(first);
	return { title: input.title.trim(), validFrom: input.validFrom, validUntil: input.validUntil };
}

export async function createPlan(
	p: Principal,
	unitId: string,
	input: PlanInput,
	file: File | null,
	ip: string,
	inform = false
) {
	const kbb = await requireKbb(unitId);
	if (!canMaintainPlans(p, unitId)) throw new PlanError('Dafür fehlt dir das Recht (Fachpflege).');
	const values = checkInput(input);
	if (!file || file.size === 0) throw new PlanError('Wähle bitte eine PDF-Datei aus.');
	let stored;
	try {
		stored = await storePdf(file, p.personId);
	} catch (err) {
		if (err instanceof FileError) throw new PlanError(err.message);
		throw err;
	}
	const [row] = await db
		.insert(plans)
		.values({ unitId, ...values, fileId: stored.id, uploadedBy: p.personId })
		.returning({ id: plans.id });
	await audit({
		category: 'admin',
		action: 'plan.upload',
		actorId: p.personId,
		tenantId: kbb.tenantId,
		entityType: 'plan',
		entityId: row.id,
		details: { unitId, ...values },
		ip
	});
	if (inform) await informAboutPlan(kbb, row.id, values.title);
	return row.id;
}

/** Neue Fassung: Datei ersetzen (alte wird gelöscht), Angaben optional anpassen. */
export async function replacePlan(
	p: Principal,
	id: string,
	input: PlanInput,
	file: File | null,
	ip: string,
	inform = false
) {
	const [plan] = await db.select().from(plans).where(eq(plans.id, id));
	if (!plan || !canMaintainPlans(p, plan.unitId)) throw new PlanError('Plan nicht gefunden.');
	const kbb = await requireKbb(plan.unitId);
	const values = checkInput(input);
	let newFileId: string | null = null;
	if (file && file.size > 0) {
		try {
			newFileId = (await storePdf(file, p.personId)).id;
		} catch (err) {
			if (err instanceof FileError) throw new PlanError(err.message);
			throw err;
		}
	}
	await db
		.update(plans)
		.set({ ...values, ...(newFileId ? { fileId: newFileId, uploadedBy: p.personId } : {}) })
		.where(eq(plans.id, id));
	if (newFileId) {
		await deleteStored([plan.fileId]);
		await audit({
			category: 'admin',
			action: 'plan.upload',
			actorId: p.personId,
			tenantId: kbb.tenantId,
			entityType: 'plan',
			entityId: id,
			details: { unitId: plan.unitId, neueFassung: true, ...values },
			ip
		});
		if (inform) await informAboutPlan(kbb, id, `${values.title} (neue Fassung)`);
	}
}

/** Personen des Mandanten, zu dem das KBB gehört (Thema „Pläne (KBB)“). */
async function informAboutPlan(
	kbb: { tenantId: string; unitName: string },
	id: string,
	title: string
) {
	await notify('plaene', await personsOfTenants([kbb.tenantId]), {
		title,
		detail: kbb.unitName,
		link: `/plaene/${id}`
	});
}

export async function deletePlan(p: Principal, id: string, ip: string) {
	const [plan] = await db.select().from(plans).where(eq(plans.id, id));
	if (!plan || !canMaintainPlans(p, plan.unitId)) throw new PlanError('Plan nicht gefunden.');
	const kbb = await requireKbb(plan.unitId);
	await db.delete(plans).where(eq(plans.id, id));
	await deleteStored([plan.fileId]);
	await audit({
		category: 'admin',
		action: 'plan.delete',
		actorId: p.personId,
		tenantId: kbb.tenantId,
		entityType: 'plan',
		entityId: id,
		details: { title: plan.title },
		ip
	});
}

/** Löschfrist „Vergessene Pläne“: Standard 3 Monate nach „Gültig bis“ (Kap. 15). */
export async function deleteForgottenPlans() {
	const months = Math.max(1, Number(await getSetting('retention.plans_months', 3)) || 3);
	const old = await db
		.select({ id: plans.id, fileId: plans.fileId })
		.from(plans)
		.where(lt(plans.validUntil, sql`(current_date - make_interval(months => ${months}))::date`));
	if (old.length === 0) return;
	await db.delete(plans).where(
		inArray(
			plans.id,
			old.map((o) => o.id)
		)
	);
	await deleteStored(old.map((o) => o.fileId));
	await audit({
		category: 'admin',
		action: 'plan.retention_delete',
		details: { count: old.length, months }
	});
}

// ---------------------------------------------------------------------------
// Organigramm
// ---------------------------------------------------------------------------

export async function getOrgChart() {
	const [row] = await db
		.select({
			fileId: orgChart.fileId,
			stand: orgChart.stand,
			size: files.size,
			updatedAt: orgChart.updatedAt
		})
		.from(orgChart)
		.innerJoin(files, eq(files.id, orgChart.fileId));
	return row ?? null;
}

export async function replaceOrgChart(p: Principal, stand: string, file: File | null, ip: string) {
	if (!canMaintainOrgChart(p))
		throw new PlanError('Dafür fehlt dir das Recht (Organigramm pflegen).');
	if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(stand))
		throw new PlanError('Gib bitte den Stand als Monat an.');
	if (!file || file.size === 0) throw new PlanError('Wähle bitte eine PDF-Datei aus.');
	let stored;
	try {
		stored = await storePdf(file, p.personId);
	} catch (err) {
		if (err instanceof FileError) throw new PlanError(err.message);
		throw err;
	}
	const [old] = await db.select({ fileId: orgChart.fileId }).from(orgChart);
	await db
		.insert(orgChart)
		.values({ id: 1, fileId: stored.id, stand, updatedBy: p.personId })
		.onConflictDoUpdate({
			target: orgChart.id,
			set: { fileId: stored.id, stand, updatedBy: p.personId, updatedAt: new Date() }
		});
	if (old) await deleteStored([old.fileId]);
	await audit({
		category: 'admin',
		action: 'org_chart.upload',
		actorId: p.personId,
		entityType: 'org_chart',
		entityId: '1',
		details: { stand },
		ip
	});
}

/** Für den Download: Gehört die Datei zu einem Plan oder dem Organigramm? */
export async function isPublicDocument(fileId: string): Promise<boolean> {
	const [a] = await db.select({ id: plans.id }).from(plans).where(eq(plans.fileId, fileId));
	if (a) return true;
	const [b] = await db
		.select({ id: orgChart.id })
		.from(orgChart)
		.where(eq(orgChart.fileId, fileId));
	return Boolean(b);
}
