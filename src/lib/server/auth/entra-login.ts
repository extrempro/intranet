/**
 * Entscheidung bei der Anmeldung über Entra (Kap. 3.1, 4.1) – ohne Datenbank
 * und Netzwerk, damit sie sich testen lässt.
 */
import { tenantFromEmail } from '../../tenant.ts';
import type { Role, RoleScope } from '../../roles.ts';

export interface GroupRoleMapping {
	groupId: string;
	role: Role;
	scope: RoleScope;
	scopeTenantId: string | null;
	scopeUnitId: string | null;
}

export interface DerivedRole extends GroupRoleMapping {
	/** Gruppe, aus der die Rolle stammt. */
	groupId: string;
}

export interface EntraLoginInput {
	email: string;
	/** IDs aller (auch verschachtelten) Gruppen der Person. */
	groupIds: readonly string[];
	accountEnabled: boolean;
	/** Zugangsgruppe; ohne Mitgliedschaft keine Anmeldung. */
	accessGroupId: string | null;
	/** Gruppe für die ersten System-Admins (ENTRA_ADMIN_GROUP_ID). */
	adminGroupId: string | null;
	/** Domain (klein) → Mandanten-ID */
	domains: Record<string, string>;
	mappings: readonly GroupRoleMapping[];
}

export type EntraLoginDenied =
	'account_disabled' | 'no_email' | 'unknown_domain' | 'not_in_access_group' | 'not_configured';

export type EntraLoginResult =
	| { ok: true; tenantId: string; email: string; roles: DerivedRole[] }
	| { ok: false; reason: EntraLoginDenied };

export function resolveEntraLogin(input: EntraLoginInput): EntraLoginResult {
	if (!input.accountEnabled) return { ok: false, reason: 'account_disabled' };
	if (!input.accessGroupId && !input.adminGroupId) return { ok: false, reason: 'not_configured' };

	const email = input.email.trim();
	if (!email.includes('@')) return { ok: false, reason: 'no_email' };

	const tenantId = tenantFromEmail(email, input.domains);
	if (!tenantId) return { ok: false, reason: 'unknown_domain' };

	const groups = new Set(input.groupIds);
	const isAdmin = input.adminGroupId !== null && groups.has(input.adminGroupId);
	const hasAccess = isAdmin || (input.accessGroupId !== null && groups.has(input.accessGroupId));
	if (!hasAccess) return { ok: false, reason: 'not_in_access_group' };

	const roles: DerivedRole[] = input.mappings.filter((m) => groups.has(m.groupId));
	if (isAdmin && input.adminGroupId) {
		roles.push({
			groupId: input.adminGroupId,
			role: 'system_admin',
			scope: 'all',
			scopeTenantId: null,
			scopeUnitId: null
		});
	}

	return { ok: true, tenantId, email, roles: dedupeRoles(roles) };
}

/** Gleiche Rolle mit gleichem Geltungsbereich nur einmal (erste Gruppe gewinnt). */
function dedupeRoles(roles: DerivedRole[]): DerivedRole[] {
	const seen = new Set<string>();
	return roles.filter((r) => {
		const key = `${r.role}|${r.scope}|${r.scopeTenantId ?? ''}|${r.scopeUnitId ?? ''}`;
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

/** Meldungen für die Anmeldeseite (per „du“). Keine Details, die Angreifern helfen. */
export const DENIED_MESSAGES: Record<EntraLoginDenied | 'failed' | 'local_conflict', string> = {
	account_disabled: 'Dein Konto ist gesperrt. Wende dich bitte an die IT.',
	no_email:
		'Für dein Microsoft-Konto ist keine E-Mail-Adresse hinterlegt. Wende dich bitte an die IT.',
	unknown_domain:
		'Deine E-Mail-Adresse gehört zu keinem Haus, das hier eingerichtet ist. Wende dich bitte an die IT.',
	not_in_access_group: 'Du hast noch keinen Zugang zum Intranet. Wende dich bitte an die IT.',
	not_configured: 'Die Anmeldung mit Microsoft ist noch nicht eingerichtet.',
	local_conflict:
		'Für deine E-Mail-Adresse gibt es bereits ein lokales Konto. Wende dich bitte an die IT.',
	failed: 'Die Anmeldung hat nicht geklappt. Versuch es bitte noch einmal.'
};
