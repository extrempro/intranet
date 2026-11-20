import { and, desc, eq, gte, ilike, inArray, lt, or, sql } from 'drizzle-orm';
import { auditDetails, auditLabel } from '#lib/audit-labels.ts';
import { isSystemAdmin } from '#lib/server/auth/access.ts';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { auditLog, persons, tenants } from '#lib/server/db/schema.ts';
import { administrableTenants } from '#lib/server/units.ts';
import type { PageServerLoad } from './$types';

const ZEITRAEUME = [7, 30, 90, 365];
const SEITE = 100;

/**
 * Protokoll (Kap. 14): Mandanten-Admins sehen Änderungen ihres Mandanten,
 * System-Admins alles einschließlich Anmeldeprotokoll.
 */
export const load: PageServerLoad = async ({ locals, url }) => {
	const p = requirePrincipal(locals);
	const system = isSystemAdmin(p);
	const tage = ZEITRAEUME.includes(Number(url.searchParams.get('tage')))
		? Number(url.searchParams.get('tage'))
		: 30;
	const art = system && url.searchParams.get('art') === 'security' ? 'security' : 'admin';
	const person = (url.searchParams.get('person') ?? '').trim().slice(0, 60);
	const vorParam = url.searchParams.get('vor');
	const vor = vorParam && !Number.isNaN(Date.parse(vorParam)) ? new Date(vorParam) : null;
	const mandanten = system ? null : (await administrableTenants(p)).map((t) => t.id);

	const like = `%${person.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
	const rows = await db
		.select({
			id: auditLog.id,
			at: auditLog.at,
			action: auditLog.action,
			details: auditLog.details,
			entityType: auditLog.entityType,
			ipPrefix: auditLog.ipPrefix,
			actorId: auditLog.actorId,
			actor: persons.displayName,
			tenant: tenants.shortName
		})
		.from(auditLog)
		.leftJoin(persons, eq(persons.id, auditLog.actorId))
		.leftJoin(tenants, eq(tenants.id, auditLog.tenantId))
		.where(
			and(
				sql`${auditLog.category} = ${art}`,
				gte(auditLog.at, sql`now() - make_interval(days => ${tage})`),
				vor ? lt(auditLog.at, vor) : undefined,
				mandanten
					? mandanten.length
						? inArray(auditLog.tenantId, mandanten)
						: sql`false`
					: undefined,
				person ? or(ilike(persons.displayName, like), ilike(persons.email, like)) : undefined
			)
		)
		.orderBy(desc(auditLog.at))
		.limit(SEITE + 1);

	const eintraege = rows.slice(0, SEITE).map((r) => ({
		id: r.id,
		at: r.at,
		was: auditLabel(r.action),
		aktion: r.action,
		wer: r.actor ?? (r.actorId ? 'Gelöschte Person' : 'System'),
		mandant: r.tenant,
		details: auditDetails(r.details),
		ip: art === 'security' ? r.ipPrefix : null
	}));
	return {
		eintraege,
		mehr: rows.length > SEITE ? eintraege[eintraege.length - 1].at.toISOString() : null,
		filter: { tage, art, person },
		zeitraeume: ZEITRAEUME,
		system
	};
};
