/** Lesbare Bezeichnungen für Einträge im Protokoll (Kap. 14). */
const LABELS: Record<string, string> = {
	'access.denied': 'Zugriff verweigert',
	'board_category.anlegen': 'Kategorie Schwarzes Brett angelegt',
	'entra.sync': 'Abgleich mit Entra',
	'entra.sync_start': 'Abgleich mit Entra von Hand gestartet',
	'entra_group_role.add': 'Rolle aus Entra-Gruppe hinzugefügt',
	'entra_group_role.remove': 'Rolle aus Entra-Gruppe entfernt',
	'hub.application_accept': 'Hub-Antrag angenommen',
	'hub.application_reject': 'Hub-Antrag abgelehnt',
	'hub.archive': 'Hub archiviert',
	'hub.rest': 'Hub ruht',
	'hub.resume': 'Hub wieder aktiv',
	'invitation.accepted': 'Einladung angenommen',
	'invitation.created': 'Einladung verschickt',
	'invitation.resent': 'Einladung erneut verschickt',
	'invitation.mail_failed': 'Einladung nicht zugestellt',
	'location.create': 'Standort angelegt',
	'location.update': 'Standort geändert',
	'login.entra.denied': 'Anmeldung mit Microsoft abgelehnt',
	'login.entra.success': 'Anmeldung mit Microsoft',
	'login.local.failed': 'Anmeldung fehlgeschlagen',
	'login.local.second_factor_failed': 'Zweiter Faktor falsch',
	'login.local.success': 'Anmeldung mit lokalem Konto',
	logout: 'Abmeldung',
	'menu.delete': 'Speiseplan gelöscht',
	'menu.upload': 'Speiseplan hochgeladen',
	'news.create': 'Beitrag veröffentlicht',
	'news.update': 'Beitrag geändert',
	'news.delete': 'Beitrag gelöscht',
	'org_chart.upload': 'Organigramm hochgeladen',
	'password.hibp_unavailable': 'Passwortprüfung nicht erreichbar',
	'person.delete_retention': 'Deaktiviertes Konto nach Frist gelöscht',
	'person.disable': 'Konto gesperrt',
	'person.enable': 'Konto freigegeben',
	'plan.delete': 'Plan gelöscht',
	'plan.retention_delete': 'Plan nach Frist gelöscht',
	'plan.upload': 'Plan hochgeladen',
	'reauth.failed': 'Erneute Anmeldung fehlgeschlagen',
	'reauth.success': 'Anmeldung erneut bestätigt',
	'recovery_codes.regenerated': 'Wiederherstellungscodes erneuert',
	'role.grant': 'Rolle vergeben',
	'role.revoke': 'Rolle entzogen',
	'session.ended': 'Sitzung beendet',
	'session.ended_others': 'Andere Sitzungen beendet',
	'setup.emergency_admin': 'Notfallzugang angelegt',
	'setup.emergency_link': 'Link für Notfallzugang erzeugt',
	'setup.first_admin': 'Erster Admin angelegt',
	'settings.retention': 'Löschfristen geändert',
	'settings.rules': 'Regeln für Inhalte geändert',
	'settings.update': 'Einstellung geändert',
	'tenant.admin_add': 'Mandanten-Admin hinzugefügt',
	'tenant.admin_remove': 'Mandanten-Admin entfernt',
	'tenant.bootstrap': 'Mandant eingerichtet',
	'tenant.create': 'Mandant angelegt',
	'tenant.domain_add': 'Domain hinzugefügt',
	'tenant.domain_remove': 'Domain entfernt',
	'tenant.update': 'Mandant geändert',
	'tenant.favorites': 'Standard-Favoriten geändert',
	'unit.behind_scenes': '„Hinter den Kulissen“ umgeschaltet',
	'unit.behind_scenes_on': '„Hinter den Kulissen“ freigeschaltet',
	'unit.behind_scenes_off': '„Hinter den Kulissen“ ausgeschaltet',
	'unit.create': 'Einheit angelegt',
	'unit.member_add': 'Person zum Team hinzugefügt',
	'unit.member_remove': 'Person aus dem Team entfernt',
	'unit.member_rights': 'Schreibrechte geändert',
	'unit.page_update': 'Abteilungsseite geändert',
	'unit.responsibilities_reviewed': 'Zuständigkeiten geprüft',
	'unit.update': 'Einheit geändert'
};

export function auditLabel(action: string): string {
	return LABELS[action] ?? action;
}

/** Details kurz als Text; Werte werden gekürzt, Objekte als „vorher → nachher“. */
export function auditDetails(details: Record<string, unknown> | null | undefined): string {
	if (!details) return '';
	const fmt = (v: unknown): string => {
		if (v === null || v === undefined) return '–';
		if (Array.isArray(v)) return v.map(fmt).join(' ');
		if (typeof v === 'object') {
			const o = v as Record<string, unknown>;
			if ('vorher' in o && 'nachher' in o) return `${fmt(o.vorher)} → ${fmt(o.nachher)}`;
			return JSON.stringify(o).slice(0, 80);
		}
		if (typeof v === 'boolean') return v ? 'ja' : 'nein';
		return String(v).slice(0, 80);
	};
	return Object.entries(details)
		.map(([k, v]) => `${k}: ${fmt(v)}`)
		.join(' · ')
		.slice(0, 400);
}
