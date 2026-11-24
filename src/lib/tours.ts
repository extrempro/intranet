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
				// Angeheftete, sonst der erste Beitrag
				target: 'angeheftet,beitraege',
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
	mediathek: {
		key: 'seite:mediathek',
		title: 'Mediathek',
		steps: [
			{
				target: 'mediathek-suche',
				title: 'Suchen und filtern',
				text: 'Die Suche findet Wörter in Titel, Beschreibung und Untertiteln. Filtere nach Abteilung, Hub oder Thema.'
			},
			{
				// Angefangene Videos, sonst das erste Video
				target: 'weiter,video',
				title: 'Ansehen und weiterschauen',
				text: 'Angefangene Videos stehen oben unter „Weiter ansehen“ und laufen dort weiter, wo du aufgehört hast. Beim Video findest du Untertitel, Kapitel und die Textfassung.'
			},
			{
				target: 'hochladen',
				title: 'Selbst hochladen',
				text: 'Mit dem Recht „Mediathek“ in deiner Abteilung oder deinem Hub lädst du Videos hoch. Bis sie veröffentlicht sind, stehen sie unter „In Arbeit und Entwürfe“.'
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
				text: 'Kurzinfo, Kontakt, Leitung, Stellvertretung und „Über uns“ pflegst du hier.'
			},
			{
				target: 'zustaendigkeiten',
				title: 'Wer hilft bei was?',
				text: 'Zuständigkeiten mit Ansprechperson und Vertretung. Einmal im Jahr bestätigst du mit „Alles geprüft“.'
			},
			{
				target: 'team',
				title: 'Team und Schreibrechte',
				text: 'Personen suchen und hinzufügen, auch aus Entra. Je Person gibst du Rechte frei, etwa Neuigkeiten, Termine, Dokumente oder Mediathek, und legst die Stammabteilung fest.'
			},
			{
				target: 'gestaltung',
				title: 'Aufbau, Schnellzugriff und Dokumente',
				text: 'Reihenfolge der Reiter, Blöcke im Überblick, Schnellzugriff-Kacheln und Dokumente mit Ordnern. Gespeichert wird alles mit einem Klick.'
			}
		]
	},
	hub_team: {
		key: 'rolle:hub_team',
		title: 'Hub-Team',
		steps: [
			{
				target: 'hinweis',
				title: 'Kurzinfo und Koordination',
				text: 'Worum es im Hub geht, in einer Zeile, und wer koordiniert.'
			},
			{
				target: 'aufbau',
				title: 'Aufbau der Seite',
				text: 'Reihenfolge der Reiter festlegen und die Blöcke im Überblick ein- und ausblenden und sortieren.'
			},
			{
				target: 'team',
				title: 'Hub-Team',
				text: 'Weitere Personen ins Team holen, auch aus Entra, Aufgaben festlegen und Rechte wie Beiträge, Termine oder Dokumente vergeben.'
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
				text: 'Einheiten ohne eigene Pflegeperson pflegt die Redaktion, auch Beiträge, FAQs und Termine.'
			},
			{
				target: 'zu-pruefen',
				title: 'Zu prüfen',
				text: 'Überfällige Zuständigkeiten, ablaufende Beiträge, alte FAQs und inaktive Ansprechpersonen. Noch richtige FAQs bestätigst du mit „Noch aktuell“.'
			},
			{
				target: 'hervorgehoben',
				title: 'Eingreifen',
				text: 'Bei dringenden und angehefteten Beiträgen löst du das Anheften, beendest „Dringend“ oder lässt einen Beitrag sofort ablaufen. Jeder Eingriff steht im Protokoll.'
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
				target: 'nachrichten',
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
