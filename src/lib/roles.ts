/**
 * Rollen und ihre erlaubten Geltungsbereiche (docs/spec.md, Kap. 5.1).
 * Die Datenbank prüft nur, dass die Spalten zum Geltungsbereich passen;
 * welche Rolle welchen Bereich haben darf, steht hier.
 */
export const ROLES = [
	'redaktion',
	'abteilungsverwaltung',
	'hub_team',
	'organigramm_pflegen',
	'vereinbarungen_pflegen',
	'fachpflege',
	'moderation_schwarzes_brett',
	'mandanten_admin',
	'system_admin'
] as const;

export type Role = (typeof ROLES)[number];
export type RoleScope = 'all' | 'tenant' | 'unit';
export type UnitType = 'geschaeftsfuehrung' | 'stabsstelle' | 'abteilung' | 'hub';

interface RoleDefinition {
	label: string;
	scopes: readonly RoleScope[];
	/** Bei Geltungsbereich „unit“: erlaubte Einheitstypen. */
	unitTypes?: readonly UnitType[];
}

export const ROLE_DEFINITIONS: Record<Role, RoleDefinition> = {
	redaktion: { label: 'Redaktion', scopes: ['tenant', 'all'] },
	abteilungsverwaltung: {
		label: 'Abteilungsverwaltung',
		scopes: ['unit'],
		unitTypes: ['geschaeftsfuehrung', 'stabsstelle', 'abteilung']
	},
	hub_team: { label: 'Hub-Team', scopes: ['unit'], unitTypes: ['hub'] },
	organigramm_pflegen: { label: 'Organigramm pflegen', scopes: ['all'] },
	vereinbarungen_pflegen: { label: 'Vereinbarungen pflegen', scopes: ['tenant'] },
	fachpflege: { label: 'Fachpflege', scopes: ['unit'], unitTypes: ['abteilung'] },
	moderation_schwarzes_brett: { label: 'Moderation Schwarzes Brett', scopes: ['tenant'] },
	mandanten_admin: { label: 'Mandanten-Admin', scopes: ['tenant'] },
	system_admin: { label: 'System-Admin', scopes: ['all'] }
};

export function isRole(value: string): value is Role {
	return (ROLES as readonly string[]).includes(value);
}

/**
 * Prüft, ob eine Rolle mit diesem Geltungsbereich vergeben werden darf.
 * @param unitType Typ der Einheit, nur bei Geltungsbereich „unit“ nötig
 */
export function isValidRoleScope(role: Role, scope: RoleScope, unitType?: UnitType): boolean {
	const def = ROLE_DEFINITIONS[role];
	if (!def.scopes.includes(scope)) return false;
	if (scope !== 'unit') return true;
	return unitType !== undefined && (def.unitTypes?.includes(unitType) ?? false);
}

/** Bezeichnung einer Einheit: Freitext-Titel, sonst Typbezeichnung (Kap. 3.2). */
export const UNIT_TYPE_LABELS: Record<UnitType, string> = {
	geschaeftsfuehrung: 'Geschäftsführung',
	stabsstelle: 'Stabsstelle',
	abteilung: 'Abteilung',
	hub: 'Hub'
};

export function unitTypeLabel(unit: { type: UnitType; title?: string | null }): string {
	const title = unit.title?.trim();
	if (title && (unit.type === 'geschaeftsfuehrung' || unit.type === 'stabsstelle')) return title;
	return UNIT_TYPE_LABELS[unit.type];
}

/**
 * Recht „Dringend“ (Kap. 8.2): ausdrücklich gesetzt oder Standard nach Typ.
 * Standard: Geschäftsführung und das KBB des Mandanten. Den Betriebsrat
 * schaltet die Verwaltung je Einheit frei.
 */
export function mayPostUrgent(unit: {
	type: UnitType;
	mayPostUrgent: boolean | null;
	isKbb: boolean;
}): boolean {
	if (unit.mayPostUrgent !== null) return unit.mayPostUrgent;
	return unit.type === 'geschaeftsfuehrung' || unit.isKbb;
}
