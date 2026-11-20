/**
 * Führung und Einführungen (Kap. 13). Ziele sind Elemente mit
 * `data-tour="…"`; fehlt ein Ziel (z. B. am Handy ausgeblendet), erscheint
 * der Schritt mittig ohne Hervorhebung.
 */

export interface TourStep {
	/** Wert von data-tour; mehrere durch Komma, das erste sichtbare zählt */
	target?: string;
	title: string;
	text: string;
}

export interface Tour {
	key: string;
	title: string;
	steps: TourStep[];
}

/** Führung beim ersten Start (8 Schritte). */
export const FUEHRUNG: Tour = {
	key: 'fuehrung',
	title: 'Führung',
	steps: [
		{
			title: 'Willkommen im Intranet',
			text: 'In acht kurzen Schritten zeigen wir dir, wo du was findest. Du kannst jederzeit abbrechen und die Führung später im Konto erneut starten.'
		},
		{
			target: 'navigation',
			title: 'Bereiche',
			text: 'Aktuelles, Organisation und Wissen: Hier findest du Neuigkeiten, Kalender, Abteilungen, FAQs, Rechtliches und mehr.'
		},
		{
			target: 'suche',
			title: 'Suche',
			text: 'Personen, Abteilungen, Beiträge, FAQs und mehr. Schon beim Tippen erscheinen Vorschläge. Tipp: Die Taste „/“ springt direkt hierher.'
		},
		{
			target: 'favoriten',
			title: 'Favoriten',
			text: 'Mit dem Stern ☆ neben einer Überschrift legst du Seiten hier ab – auch einzelne Abteilungen. Mit „Startseite anpassen“ sortierst du Favoriten und Karten.'
		},
		{
			target: 'glocke',
			title: 'Glocke',
			text: 'Deine Benachrichtigungen. Welche Themen dich wie erreichen – Glocke, Push oder E-Mail – stellst du im Konto ein.'
		},
		{
			target: 'nachrichten',
			title: 'Nachrichten',
			text: 'Gespräche zu Vorgängen: Anzeigen am Schwarzen Brett, Hub-Anträge und Rückmeldungen.'
		},
		{
			target: 'rueckmeldung',
			title: 'Rückmeldung',
			text: 'Etwas klappt nicht oder du hast eine Idee? Über die Sprechblase (am Handy im Konto-Menü) erreichst du die Verwaltung.'
		},
		{
			target: 'konto',
			title: 'Konto',
			text: 'Profil mit Foto und Kontaktdaten, Push auf diesem Gerät, Einstellungen und das Handbuch. Viel Spaß im Intranet!'
		}
	]
};

/** Einführungen auf Seiten (je 3 Schritte), beim ersten Besuch angeboten. */
export const SEITEN: Record<string, Tour> = {
	neuigkeiten: {
		key: 'seite:neuigkeiten',
		title: 'Neuigkeiten',
		steps: [
			{
				target: 'filter',
				title: 'Filter',
				text: 'Alle Neuigkeiten, nur die deiner Abteilungen oder – wenn du schreiben darfst – geplante Beiträge.'
			},
			{
				target: 'beitraege',
				title: 'Beiträge',
				text: 'Angeheftete Beiträge stehen oben. Als Absender erscheint immer die Einheit. Mit Reaktionen zeigst du, dass dir etwas gefällt.'
			},
			{
				target: 'schreiben',
				title: 'Selbst schreiben',
				text: 'Wenn deine Abteilung dir das Schreibrecht gegeben hat, schreibst du hier im Namen der Einheit.'
			}
		]
	},
	kalender: {
		key: 'seite:kalender',
		title: 'Kalender',
		steps: [
			{
				target: 'ansicht',
				title: 'Ansicht',
				text: 'Wechsle zwischen Liste und Monat und blättere durch die Zeit.'
			},
			{
				target: 'mandanten',
				title: 'Aus anderen Häusern',
				text: 'Termine deines Mandanten siehst du immer; weitere Häuser blendest du hier ein.'
			},
			{
				target: 'abo',
				title: 'Kalender-Abo',
				text: 'Mit einem persönlichen Link holst du die Termine in Outlook oder aufs Handy.'
			}
		]
	},
	brett: {
		key: 'seite:brett',
		title: 'Schwarzes Brett',
		steps: [
			{
				target: 'kategorien',
				title: 'Kategorien',
				text: 'Filtere nach Kategorie oder suche nach Stichworten.'
			},
			{
				target: 'aufgeben',
				title: 'Anzeige aufgeben',
				text: 'Neue Anzeigen prüft zuerst die Moderation. Sie laufen 30 Tage und lassen sich einmal verlängern.'
			},
			{
				target: 'meine',
				title: 'Meine Anzeigen',
				text: 'Hier verlängerst du, markierst als erledigt oder löschst. Interessierte schreiben dir über Nachrichten.'
			}
		]
	},
	nachrichten: {
		key: 'seite:nachrichten',
		title: 'Nachrichten',
		steps: [
			{
				target: 'postfaecher',
				title: 'Postfächer',
				text: 'Dein persönliches Postfach und – wenn du eine Rolle hast – das gemeinsame Postfach der Rolle.'
			},
			{
				target: 'stand',
				title: 'Offen und Erledigt',
				text: 'Erledigte Gespräche wandern hierher und werden nach einiger Zeit gelöscht.'
			},
			{
				target: 'liste',
				title: 'Gespräche',
				text: 'Jedes Gespräch gehört zu einem Vorgang; oben im Gespräch führt ein Link dorthin.'
			}
		]
	}
};

/** Einführungen für Rollen, einmalig beim ersten Öffnen des Bereichs. */
export const ROLLEN: Record<string, Tour> = {
	abteilungsverwaltung: {
		key: 'rolle:abteilungsverwaltung',
		title: 'Abteilungsverwaltung',
		steps: [
			{
				target: 'seite',
				title: 'Deine Abteilungsseite',
				text: 'Leitung, Stellvertretung und „Über uns“ pflegst du hier.'
			},
			{
				target: 'zustaendigkeiten',
				title: 'Wer hilft bei was?',
				text: 'Zuständigkeiten mit Ansprechperson und Vertretung. Einmal im Jahr bestätigst du mit „Alles geprüft“.'
			},
			{
				target: 'team',
				title: 'Team und Schreibrechte',
				text: 'Personen hinzufügen und je Person Neuigkeiten, FAQs, Termine und Hinter den Kulissen freigeben.'
			}
		]
	},
	hub_team: {
		key: 'rolle:hub_team',
		title: 'Hub-Team',
		steps: [
			{
				target: 'hinweis',
				title: 'Hinweis und Über uns',
				text: 'Was im Hub gerade wichtig ist und worum es geht.'
			},
			{
				target: 'aufbau',
				title: 'Aufbau der Seite',
				text: 'Abschnitte ein- und ausblenden und sortieren.'
			},
			{
				target: 'ruhen',
				title: 'Ruhen lassen',
				text: 'Pause ohne neue Beiträge; archivieren kann nur die Verwaltung.'
			}
		]
	},
	redaktion: {
		key: 'rolle:redaktion',
		title: 'Redaktion',
		steps: [
			{
				target: 'zaehler',
				title: 'Arbeitsliste',
				text: 'Je Abschnitt steht oben, was zu tun ist; ein Tipp springt dorthin.'
			},
			{
				target: 'ohne-pflege',
				title: 'Ohne Pflege',
				text: 'Einheiten ohne eigene Pflegeperson pflegt die Redaktion.'
			},
			{
				target: 'zu-pruefen',
				title: 'Zu prüfen',
				text: 'Überfällige Zuständigkeiten, ablaufende Beiträge, alte FAQs und inaktive Ansprechpersonen. Einträge verschwinden, sobald sie erledigt sind.'
			}
		]
	},
	moderation: {
		key: 'rolle:moderation',
		title: 'Moderation',
		steps: [
			{
				target: 'moderation',
				title: 'Neue und gemeldete Anzeigen',
				text: 'Freigeben, Rückfrage stellen oder mit Begründung ablehnen.'
			},
			{
				target: 'postfach',
				title: 'Gemeinsames Postfach',
				text: 'Rückfragen laufen über Nachrichten; alle mit der Rolle sehen dieselben Gespräche.'
			},
			{
				title: 'Handbuch',
				text: 'Mehr dazu steht im Handbuch unter „Schwarzes Brett moderieren“.'
			}
		]
	}
};

export const ALL_TOUR_KEYS = [
	FUEHRUNG.key,
	...Object.values(SEITEN).map((t) => t.key),
	...Object.values(ROLLEN).map((t) => t.key)
];

export function isTourKey(key: string): boolean {
	return ALL_TOUR_KEYS.includes(key);
}
