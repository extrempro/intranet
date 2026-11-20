/**
 * Verwaltung → Mandanten (Kap. 3.1, 14).
 * System-Admins legen Mandanten an und pflegen Domains und Mandanten-Admins.
 * Mandanten-Admins pflegen Name, Kürzel und Farben des eigenen Mandanten.
 * Domains bestimmen, wer zu welchem Mandanten gehört – deshalb nur System-Admins.
 */
import { and, asc, eq, sql } from 'drizzle-orm';
import { forgetBranding } from './tenant-branding.ts';
import { HEX, normalizeUiFarben, palette, pruefePalette, type UiFarben } from '../color.ts';
import { normalizeDomain } from '../domain.ts';
import { audit } from './audit.ts';
import { canAdministerTenant, isSystemAdmin, type Principal } from './auth/access.ts';
import { db } from './db/index.ts';
import { persons, roleAssignments, tenantDomains, tenants } from './db/schema.ts';

export class TenantError extends Error {}

const DEFAULT_ACCENT = '#0F6E56';
const DEFAULT_ACCENT_DARK = '#5DCAA5';

function requireSystemAdmin(p: Principal) {
	if (!isSystemAdmin(p)) throw new TenantError('Das dürfen nur System-Admins.');
}

export async function listTenants(p: Principal) {
	const rows = await db
		.select({
			id: tenants.id,
			name: tenants.name,
			shortName: tenants.shortName,
			isMain: tenants.isMain,
			accent: tenants.accentColor,
			domains: sql<
				string[]
			>`coalesce((select array_agg(d.domain order by d.domain) from tenant_domains d where d.tenant_id = ${tenants.id}), '{}')`
		})
		.from(tenants)
		.orderBy(sql`${tenants.isMain} desc`, asc(tenants.name));
	return rows.filter((t) => canAdministerTenant(p, t.id));
}

export async function getTenant(p: Principal, id: string) {
	if (!/^[0-9a-f-]{36}$/i.test(id) || !canAdministerTenant(p, id))
		throw new TenantError('Mandant nicht gefunden.');
	const [t] = await db.select().from(tenants).where(eq(tenants.id, id));
	if (!t) throw new TenantError('Mandant nicht gefunden.');
	const [domains, admins] = await Promise.all([
		db
			.select({ domain: tenantDomains.domain })
			.from(tenantDomains)
			.where(eq(tenantDomains.tenantId, id))
			.orderBy(asc(tenantDomains.domain)),
		db
			.select({
				personId: persons.id,
				name: persons.displayName,
				email: persons.email,
				source: roleAssignments.source
			})
			.from(roleAssignments)
			.innerJoin(persons, eq(persons.id, roleAssignments.personId))
			.where(
				and(eq(roleAssignments.role, 'mandanten_admin'), eq(roleAssignments.scopeTenantId, id))
			)
			.orderBy(asc(persons.displayName))
	]);
	return {
		id: t.id,
		name: t.name,
		shortName: t.shortName,
		isMain: t.isMain,
		accent: t.accentColor ?? DEFAULT_ACCENT,
		accentDark: t.accentColorDark ?? DEFAULT_ACCENT_DARK,
		bg: t.bgColor ?? '',
		bgDark: t.bgColorDark ?? '',
		ui: normalizeUiFarben(t.uiColors),
		domains: domains.map((d) => d.domain),
		admins
	};
}

export interface TenantInput {
	name: string;
	shortName: string;
	accent: string;
	accentDark: string;
	/** Seitenhintergrund; leer = Standard */
	bg: string;
	bgDark: string;
	/** Weitere Oberflächenfarben je Darstellung */
	ui: UiFarben;
}

function checkInput(input: TenantInput) {
	const name = input.name.trim();
	const shortName = input.shortName.trim();
	if (name.length < 2 || name.length > 120)
		throw new TenantError('Der Name braucht 2 bis 120 Zeichen.');
	if (shortName.length < 1 || shortName.length > 10)
		throw new TenantError('Das Kürzel braucht 1 bis 10 Zeichen.');
	if (!HEX.test(input.accent) || !HEX.test(input.accentDark))
		throw new TenantError('Farben bitte als #RRGGBB angeben.');
	const bg = input.bg.trim();
	const bgDark = input.bgDark.trim();
	if ((bg && !HEX.test(bg)) || (bgDark && !HEX.test(bgDark)))
		throw new TenantError('Hintergrundfarben bitte als #RRGGBB angeben oder leer lassen.');
	const ui = normalizeUiFarben(input.ui);
	const z = (n: number) => `${n.toFixed(1).replace('.', ',')}:1`;
	for (const [modus, titel, akzent, hg] of [
		['hell', 'Hell', input.accent, bg],
		['dunkel', 'Dunkel', input.accentDark, bgDark]
	] as const) {
		const k = pruefePalette(
			palette(modus, akzent, input.accent, { ...ui[modus], hintergrund: hg || undefined })
		);
		if (!k.ok)
			throw new TenantError(
				`${titel}: zu wenig Kontrast (mindestens 4,5:1) – Text ${z(k.text)}, grauer Text ${z(k.grau)}, Links ${z(k.akzent)}, weiße Schrift auf Knöpfen ${z(k.knopf)}.`
			);
	}
	return {
		name,
		shortName,
		accentColor: input.accent.toUpperCase(),
		accentColorDark: input.accentDark.toUpperCase(),
		bgColor: bg ? bg.toUpperCase() : null,
		bgColorDark: bgDark ? bgDark.toUpperCase() : null,
		uiColors: Object.keys(ui).length ? ui : null
	};
}

async function uniqueShort(shortName: string, exceptId?: string) {
	const [hit] = await db
		.select({ id: tenants.id })
		.from(tenants)
		.where(sql`lower(${tenants.shortName}) = lower(${shortName})`);
	if (hit && hit.id !== exceptId) throw new TenantError('Dieses Kürzel ist schon vergeben.');
}

export async function createTenant(p: Principal, input: TenantInput, ip: string): Promise<string> {
	requireSystemAdmin(p);
	const values = checkInput(input);
	await uniqueShort(values.shortName);
	const [{ n }] = await db
		.select({ n: sql<number>`count(*)::int` })
		.from(tenants)
		.where(eq(tenants.isMain, true));
	const [row] = await db
		.insert(tenants)
		.values({ ...values, isMain: n === 0 })
		.returning({ id: tenants.id });
	await audit({
		category: 'admin',
		action: 'tenant.create',
		actorId: p.personId,
		tenantId: row.id,
		entityType: 'tenant',
		entityId: row.id,
		details: { name: values.name },
		ip
	});
	return row.id;
}

export async function updateTenant(p: Principal, id: string, input: TenantInput, ip: string) {
	await getTenant(p, id);
	const values = checkInput(input);
	await uniqueShort(values.shortName, id);
	await db.update(tenants).set(values).where(eq(tenants.id, id));
	forgetBranding();
	await audit({
		category: 'admin',
		action: 'tenant.update',
		actorId: p.personId,
		tenantId: id,
		entityType: 'tenant',
		entityId: id,
		details: values,
		ip
	});
}

export async function addDomain(p: Principal, id: string, raw: string, ip: string) {
	requireSystemAdmin(p);
	await getTenant(p, id);
	const domain = normalizeDomain(raw);
	if (!domain) throw new TenantError('Das ist keine gültige Domain (z. B. staatsoper-hamburg.de).');
	const [hit] = await db
		.select({ tenantId: tenantDomains.tenantId })
		.from(tenantDomains)
		.where(eq(tenantDomains.domain, domain));
	if (hit)
		throw new TenantError(
			hit.tenantId === id
				? 'Diese Domain ist schon eingetragen.'
				: 'Diese Domain gehört schon zu einem anderen Mandanten.'
		);
	await db.insert(tenantDomains).values({ domain, tenantId: id });
	await audit({
		category: 'admin',
		action: 'tenant.domain_add',
		actorId: p.personId,
		tenantId: id,
		entityType: 'tenant',
		entityId: id,
		details: { domain },
		ip
	});
}

export async function removeDomain(p: Principal, id: string, domain: string, ip: string) {
	requireSystemAdmin(p);
	await getTenant(p, id);
	const removed = await db
		.delete(tenantDomains)
		.where(and(eq(tenantDomains.tenantId, id), eq(tenantDomains.domain, domain)))
		.returning({ domain: tenantDomains.domain });
	if (removed.length) {
		await audit({
			category: 'admin',
			action: 'tenant.domain_remove',
			actorId: p.personId,
			tenantId: id,
			entityType: 'tenant',
			entityId: id,
			details: { domain },
			ip
		});
	}
}

export async function addAdmin(p: Principal, id: string, email: string, ip: string) {
	requireSystemAdmin(p);
	await getTenant(p, id);
	const [person] = await db
		.select({ id: persons.id, tenantId: persons.tenantId })
		.from(persons)
		.where(
			and(
				sql`lower(${persons.email}) = lower(${email.trim()})`,
				sql`not exists (select 1 from location_operators lo where lo.person_id = ${persons.id})`
			)
		);
	if (!person || person.tenantId !== id) {
		throw new TenantError(
			'Keine Person mit dieser E-Mail-Adresse in diesem Mandanten. Sie muss sich vorher einmal angemeldet haben.'
		);
	}
	await db
		.insert(roleAssignments)
		.values({
			personId: person.id,
			role: 'mandanten_admin',
			scope: 'tenant',
			scopeTenantId: id,
			createdBy: p.personId
		})
		.onConflictDoNothing();
	await audit({
		category: 'admin',
		action: 'tenant.admin_add',
		actorId: p.personId,
		tenantId: id,
		entityType: 'tenant',
		entityId: id,
		details: { personId: person.id },
		ip
	});
}

export async function removeAdmin(p: Principal, id: string, personId: string, ip: string) {
	requireSystemAdmin(p);
	await getTenant(p, id);
	// Rollen aus Entra-Gruppen werden in Entra verwaltet
	const removed = await db
		.delete(roleAssignments)
		.where(
			and(
				eq(roleAssignments.personId, personId),
				eq(roleAssignments.role, 'mandanten_admin'),
				eq(roleAssignments.scopeTenantId, id),
				eq(roleAssignments.source, 'manual')
			)
		)
		.returning({ id: roleAssignments.id });
	if (removed.length) {
		await audit({
			category: 'admin',
			action: 'tenant.admin_remove',
			actorId: p.personId,
			tenantId: id,
			entityType: 'tenant',
			entityId: id,
			details: { personId },
			ip
		});
	}
}
