/**
 * Navigation der Verwaltung (Gruppen links, Entwurf „admin“). „system“: nur
 * für System-Admins sichtbar; die Seiten prüfen ihr Recht zusätzlich selbst.
 */
export interface VerwaltungsSeite {
	key: string;
	label: string;
	text: string;
	icon: string;
	system?: boolean;
}

export interface VerwaltungsGruppe {
	label: string;
	seiten: VerwaltungsSeite[];
}

export const VERWALTUNG: VerwaltungsGruppe[] = [
	{
		label: 'Organisation',
		seiten: [
			{
				key: 'mandanten',
				label: 'Mandanten',
				text: 'Domains, Farben, Mandanten-Admins',
				icon: 'M4 4h6v6h-6zM14 4h6v6h-6zM4 14h6v6h-6zM14 14h6v6h-6z'
			},
			{
				key: 'abteilungen',
				label: 'Abteilungen und Hubs',
				text: 'Einheiten, Team, Schreibrechte',
				icon: 'M3 21h18M5 21v-14l8 -4v18M19 21v-10l-6 -4M9 9v.01M9 12v.01M9 15v.01M9 18v.01'
			},
			{
				key: 'standorte',
				label: 'Standorte',
				text: 'Kantinen und Betreiber-Konten',
				icon: 'M12 11m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0M17.66 16.66l-4.24 4.24a2 2 0 0 1 -2.83 0l-4.25 -4.24a8 8 0 1 1 11.31 0z'
			}
		]
	},
	{
		label: 'Zugänge',
		seiten: [
			{
				key: 'benutzer',
				label: 'Benutzer und Rollen',
				text: 'Rollen vergeben, Konten sperren',
				icon: 'M9 7m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0M3 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2M16 3.13a4 4 0 0 1 0 7.75M21 21v-2a4 4 0 0 0 -3 -3.85'
			},
			{
				key: 'einladen',
				label: 'Lokales Konto einladen',
				text: 'Für Personen ohne Microsoft-Konto',
				icon: 'M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0M16 19h6M19 16v6M6 21v-2a4 4 0 0 1 4 -4h4'
			},
			{
				key: 'anmeldung',
				label: 'Anmeldung',
				text: 'Microsoft Entra, Passwörter, Abmelden nach Inaktivität',
				icon: 'M15 8v-2a2 2 0 0 0 -2 -2h-7a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h7a2 2 0 0 0 2 -2v-2M21 12h-13l3 -3M11 15l-3 -3',
				system: true
			},
			{
				key: 'entra-gruppen',
				label: 'Rollen aus Entra-Gruppen',
				text: 'Gruppe → Rolle zuordnen',
				icon: 'M10 13a2 2 0 1 0 4 0a2 2 0 0 0 -4 0M8 21v-1a2 2 0 0 1 2 -2h4a2 2 0 0 1 2 2v1M15 5a2 2 0 1 0 4 0a2 2 0 0 0 -4 0M17 10h2a2 2 0 0 1 2 2v1M5 5a2 2 0 1 0 4 0a2 2 0 0 0 -4 0M3 13v-1a2 2 0 0 1 2 -2h2',
				system: true
			}
		]
	},
	{
		label: 'Inhalte',
		seiten: [
			{
				key: 'regeln',
				label: 'Regeln für Inhalte',
				text: 'Anheften, Dringend, Schreibrechte, Reaktionen …',
				icon: 'M15 4.5l-4 4l-4 1.5l-1.5 1.5l7 7l1.5 -1.5l1.5 -4l4 -4M9 15l-4.5 4.5M14.5 4l5.5 5.5'
			},
			{
				key: 'kulissen',
				label: 'Hinter den Kulissen',
				text: 'Hinweis „So geht’s“',
				icon: 'M5 7h1a2 2 0 0 0 2 -2a1 1 0 0 1 1 -1h6a1 1 0 0 1 1 1a2 2 0 0 0 2 2h1a2 2 0 0 1 2 2v9a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-9a2 2 0 0 1 2 -2M12 13m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0',
				system: true
			},
			{
				key: 'schwarzes-brett',
				label: 'Schwarzes Brett',
				text: 'Kategorien',
				icon: 'M9 4v6l-2 4v2h10v-2l-2 -4v-6M12 16v5M8 4h8',
				system: true
			},
			{
				key: 'themen',
				label: 'Themen',
				text: 'Themen der Mediathek und FAQs, Vorschläge',
				icon: 'M7.5 7.5m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0M3 6v5.172a2 2 0 0 0 .586 1.414l7.71 7.71a2.41 2.41 0 0 0 3.408 0l5.592 -5.592a2.41 2.41 0 0 0 0 -3.408l-7.71 -7.71a2 2 0 0 0 -1.414 -.586h-5.172a3 3 0 0 0 -3 3z',
				system: true
			},
			{
				key: 'loeschfristen',
				label: 'Löschfristen',
				text: 'Wann was gelöscht wird',
				icon: 'M4 7l16 0M10 11l0 6M14 11l0 6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3'
			}
		]
	},
	{
		label: 'Betrieb',
		seiten: [
			{
				key: 'system',
				label: 'System',
				text: 'Zustand, Sicherungen, Version',
				icon: 'M10.325 4.317c.426 -1.756 2.924 -1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543 -.94 3.31 .826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756 .426 1.756 2.924 0 3.35a1.724 1.724 0 0 0 -1.066 2.573c.94 1.543 -.826 3.31 -2.37 2.37a1.724 1.724 0 0 0 -2.572 1.065c-.426 1.756 -2.924 1.756 -3.35 0a1.724 1.724 0 0 0 -2.573 -1.066c-1.543 .94 -3.31 -.826 -2.37 -2.37a1.724 1.724 0 0 0 -1.065 -2.572c-1.756 -.426 -1.756 -2.924 0 -3.35a1.724 1.724 0 0 0 1.066 -2.573c-.94 -1.543 .826 -3.31 2.37 -2.37c1 .608 2.296 .07 2.572 -1.065zM9 12a3 3 0 1 0 6 0a3 3 0 0 0 -6 0',
				system: true
			},
			{
				key: 'speicher',
				label: 'Speicher',
				text: 'Speicherorte, S3, Umzug der Dateien',
				icon: 'M4 6a8 3 0 1 0 16 0a8 3 0 1 0 -16 0M4 6v6a8 3 0 0 0 16 0v-6M4 12v6a8 3 0 0 0 16 0v-6',
				system: true
			},
			{
				key: 'benachrichtigungen',
				label: 'Benachrichtigungen',
				text: 'Web Push, E-Mail, Teams, Testnachricht',
				icon: 'M10 5a2 2 0 1 1 4 0a7 7 0 0 1 4 6v3a4 4 0 0 0 2 3h-16a4 4 0 0 0 2 -3v-3a7 7 0 0 1 4 -6M9 17v1a3 3 0 0 0 6 0v-1'
			},
			{
				key: 'rueckmeldungen',
				label: 'Rückmeldungen',
				text: 'Fehler und Ideen bearbeiten',
				icon: 'M8 9h8M8 13h6M18 4a3 3 0 0 1 3 3v8a3 3 0 0 1 -3 3h-5l-5 3v-3h-2a3 3 0 0 1 -3 -3v-8a3 3 0 0 1 3 -3h12z'
			},
			{
				key: 'protokoll',
				label: 'Protokoll',
				text: 'Änderungen in der Verwaltung',
				icon: 'M9 6l11 0M9 12l11 0M9 18l11 0M5 6l0 .01M5 12l0 .01M5 18l0 .01'
			}
		]
	}
];

/** Gruppen mit den Seiten, die die Person sehen darf. */
export function verwaltungFuer(systemAdmin: boolean): VerwaltungsGruppe[] {
	return VERWALTUNG.map((g) => ({
		...g,
		seiten: g.seiten.filter((s) => systemAdmin || !s.system)
	})).filter((g) => g.seiten.length > 0);
}
