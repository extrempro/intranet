/** Werte für die Startklar-Prüfung sammeln (Bewertung: src/lib/startklar.ts) */
import { and, eq, sql } from 'drizzle-orm';
import { bewerteStartklar } from '../startklar.ts';
import { getEntraConfig } from './auth/entra.ts';
import { lastSync } from './auth/entra-sync.ts';
import { db } from './db/index.ts';
import { persons, roleAssignments, tenants } from './db/schema.ts';
import { mailConfigured } from './mail.ts';
import { pushStatus } from './push.ts';
import { backupStatus, migrationStatus } from './system.ts';
import { teamsStatus } from './teams.ts';
import { teamsAppIdAusEnv, teamsSettings } from './teams-config.ts';

export async function startklar(erkannteAdresse: string | null) {
	const [entra, abgleich, mail, sicherung, push, teams, teamsLetzte, migrationen] =
		await Promise.all([
			getEntraConfig(),
			lastSync(),
			mailConfigured(),
			backupStatus(),
			pushStatus(),
			teamsSettings(),
			teamsStatus(),
			migrationStatus()
		]);
	const [admins] = await db
		.select({ n: sql<number>`count(distinct ${persons.id})::int` })
		.from(roleAssignments)
		.innerJoin(persons, eq(persons.id, roleAssignments.personId))
		.where(
			and(
				eq(roleAssignments.role, 'system_admin'),
				eq(persons.authSource, 'local'),
				eq(persons.status, 'active')
			)
		);
	const [haupt] = await db
		.select({ datenschutz: tenants.privacyUrl, impressum: tenants.imprintUrl })
		.from(tenants)
		.where(eq(tenants.isMain, true));
	return bewerteStartklar({
		origin: process.env.ORIGIN?.trim() || null,
		addressHeader: process.env.ADDRESS_HEADER?.trim() || null,
		erkannteAdresse,
		entra: Boolean(entra),
		abgleich: abgleich ? { ok: abgleich.ok, zeit: abgleich.zeit } : null,
		lokaleSystemAdmins: admins?.n ?? 0,
		mail,
		sicherung: { eingerichtet: Boolean(sicherung), befunde: sicherung?.befunde ?? [] },
		push: push.keys,
		rechtliches: { datenschutz: Boolean(haupt?.datenschutz), impressum: Boolean(haupt?.impressum) },
		teams: {
			aktiv: teams.aktiv,
			appId: teams.appId,
			appIdFest: teamsAppIdAusEnv() !== null,
			letzte: teamsLetzte ? { ok: teamsLetzte.ok, meldung: teamsLetzte.meldung } : null
		},
		migrationen
	});
}
