/**
 * Nächtlicher Abgleich mit Entra (Kap. 4.1) – Entscheidung je Person ohne
 * Datenbank und Netzwerk, damit sie sich testen lässt. Es gelten dieselben
 * Regeln wie bei der Anmeldung (resolveEntraLogin).
 */
import {
	resolveEntraLogin,
	type DerivedRole,
	type EntraLoginDenied,
	type GroupRoleMapping
} from './entra-login.ts';

export interface SyncPerson {
	id: string;
	oid: string;
	email: string;
	displayName: string;
	tenantId: string;
	status: 'active' | 'invited' | 'disabled';
	disabledBy: 'verwaltung' | 'entra' | null;
	/** Schlüssel der aktuellen Rollen aus Entra (rolleSchluessel) */
	entraRoles: string[];
}

export interface GraphUser {
	id: string;
	displayName: string | null;
	mail: string | null;
	userPrincipalName: string;
	accountEnabled?: boolean;
}

/** null: In Entra nicht (mehr) vorhanden */
export type Lookup = { user: GraphUser; groupIds: string[] } | null;

export interface SyncContext {
	accessGroupId: string | null;
	adminGroupId: string | null;
	domains: Record<string, string>;
	mappings: readonly GroupRoleMapping[];
}

export type SperrGrund = EntraLoginDenied | 'geloescht';

export type SyncAction =
	| {
			art: 'abgleichen';
			person: SyncPerson;
			/** Konto war von Entra gesperrt und ist jetzt wieder gültig */
			freigeben: boolean;
			email: string;
			displayName: string;
			tenantId: string;
			roles: DerivedRole[];
			geaendert: boolean;
			rollenGeaendert: boolean;
	  }
	| { art: 'sperren'; person: SyncPerson; grund: SperrGrund }
	| { art: 'bleibt_gesperrt'; person: SyncPerson };

export function rolleSchluessel(r: {
	role: string;
	scope: string;
	scopeTenantId: string | null;
	scopeUnitId: string | null;
}): string {
	return `${r.role}|${r.scope}|${r.scopeTenantId ?? ''}|${r.scopeUnitId ?? ''}`;
}

export function planPerson(person: SyncPerson, lookup: Lookup, ctx: SyncContext): SyncAction {
	const gesperrt = person.status === 'disabled';
	if (!lookup)
		return gesperrt
			? { art: 'bleibt_gesperrt', person }
			: { art: 'sperren', person, grund: 'geloescht' };

	const decision = resolveEntraLogin({
		email: lookup.user.mail ?? lookup.user.userPrincipalName ?? '',
		groupIds: lookup.groupIds,
		accountEnabled: lookup.user.accountEnabled !== false,
		accessGroupId: ctx.accessGroupId,
		adminGroupId: ctx.adminGroupId,
		domains: ctx.domains,
		mappings: ctx.mappings
	});
	if (!decision.ok)
		return gesperrt
			? { art: 'bleibt_gesperrt', person }
			: { art: 'sperren', person, grund: decision.reason };

	const displayName = lookup.user.displayName?.trim() || decision.email;
	const neu = decision.roles.map(rolleSchluessel).sort();
	const alt = [...person.entraRoles].sort();
	const rollenGeaendert = neu.length !== alt.length || neu.some((k, i) => k !== alt[i]);
	const geaendert =
		person.email !== decision.email ||
		person.displayName !== displayName ||
		person.tenantId !== decision.tenantId;
	return {
		art: 'abgleichen',
		person,
		freigeben: gesperrt,
		email: decision.email,
		displayName,
		tenantId: decision.tenantId,
		roles: decision.roles,
		geaendert,
		rollenGeaendert
	};
}

/**
 * Schutz vor Fehlkonfiguration (z. B. falsche Zugangsgruppe): Würde der Abgleich
 * mehr als 10 % der aktiven Konten (mindestens 5) sperren, hält er an.
 */
export function zuVieleSperren(actions: SyncAction[]): { sperren: number; aktiv: number } | null {
	const aktiv = actions.filter((a) => a.person.status !== 'disabled').length;
	const sperren = actions.filter((a) => a.art === 'sperren').length;
	return sperren > 5 && sperren > aktiv * 0.1 ? { sperren, aktiv } : null;
}

export const SPERR_GRUENDE: Record<SperrGrund, string> = {
	geloescht: 'in Entra gelöscht',
	account_disabled: 'in Entra deaktiviert',
	not_in_access_group: 'nicht mehr in der Zugangsgruppe',
	unknown_domain: 'E-Mail-Domain keinem Mandanten zugeordnet',
	no_email: 'keine E-Mail-Adresse in Entra',
	not_configured: 'Anmeldung nicht eingerichtet'
};
