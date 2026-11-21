/**
 * Gemeinsamer Abschluss einer Microsoft-Anmeldung (Browser und Teams):
 * Profil und Gruppen per Graph lesen, Zugang prüfen, Person anlegen oder
 * abgleichen. Die Sitzung legt der Aufrufer an, weil das Cookie je nach Weg
 * unterschiedlich ist.
 */
import { fetchGroupIds, fetchMe, getEntraConfig } from './entra.ts';
import { resolveEntraLogin } from './entra-login.ts';
import { loadLoginContext, upsertEntraPerson } from './entra-persist.ts';
import { seedFavorites } from '../preferences.ts';

export type EntraFinish =
	| { ok: true; personId: string; tenantId: string; created: boolean; roles: string[] }
	| { ok: false; reason: string; cause?: string };

export async function finishEntraLogin(oid: string, graphToken: string): Promise<EntraFinish> {
	const entra = await getEntraConfig();
	if (!entra) return { ok: false, reason: 'not_configured' };

	let me: Awaited<ReturnType<typeof fetchMe>>;
	let groupIds: string[];
	try {
		[me, groupIds] = await Promise.all([fetchMe(graphToken), fetchGroupIds(graphToken)]);
	} catch (err) {
		console.error('Microsoft Graph nicht erreichbar:', err);
		return { ok: false, reason: 'failed', cause: 'graph' };
	}
	if (me.id !== oid) return { ok: false, reason: 'failed', cause: 'oid_mismatch' };

	const context = await loadLoginContext();
	const decision = resolveEntraLogin({
		email: me.mail ?? me.userPrincipalName ?? '',
		groupIds,
		accountEnabled: me.accountEnabled !== false,
		accessGroupId: entra.accessGroupId,
		adminGroupId: entra.adminGroupId,
		domains: context.domains,
		mappings: context.mappings
	});
	if (!decision.ok) return { ok: false, reason: decision.reason };

	const saved = await upsertEntraPerson({
		oid,
		email: decision.email,
		displayName: me.displayName?.trim() || decision.email,
		tenantId: decision.tenantId,
		roles: decision.roles
	});
	if (!saved.ok) return { ok: false, reason: saved.reason };
	// Neue Person: Standard-Favoriten ihres Mandanten (Kap. 7)
	if (saved.created) await seedFavorites(saved.personId, decision.tenantId);
	return {
		ok: true,
		personId: saved.personId,
		tenantId: decision.tenantId,
		created: saved.created,
		roles: decision.roles.map((r) => r.role)
	};
}
