# Prüfung Barrierefreiheit (WCAG 2.2, Stufe AA)

Stand: 21.11.2026 · Grundlage: Kap. 17 der Spezifikation · Geprüft: laufende Instanz (Produktions-Build, zwei Mandanten, Rollen System-Admin, Mandanten-Admin, Betreiber-Konto, ohne Anmeldung).

## Vorgehen

1. **Automatisch mit axe-core 4.14** (Regeln WCAG 2.0, 2.1 und 2.2, jeweils A und AA) auf allen erreichbaren Seiten: Ein Skript folgt allen Links des Intranets und prüft jede Seitenart einmal.
   - Hell, 1280 px breit: 114 Seiten
   - Dunkel, 1280 px breit: 113 Seiten
   - Hell, **320 px** breit (entspricht 400 % Zoom, WCAG 1.4.10): 92 Seiten, dazu je Seite, ob etwas waagerecht übersteht
   - Einzeln: Anmeldung, „Passwort vergessen“, Einladung, Einrichtung, Fehlerseiten, Betreiber-Bereich
2. **Tastatur**: auf Startseite, Konto, Beitragsformular, Kalender, Verwaltung, Schwarzem Brett und Plänen je 80 × Tab: sichtbarer Fokus, Fokus nicht von der festen Kopfzeile verdeckt.
3. **Code-Durchsicht**: Schalter (`role="switch"`), Live-Regionen für Meldungen, „Bewegung reduzieren“, Überschriften (genau eine `h1` je Seite).

Automatische Prüfungen finden erfahrungsgemäß nur einen Teil der Probleme. Ein Test mit Bildschirmleser (NVDA, VoiceOver) und mit Menschen, die darauf angewiesen sind, ersetzt das nicht.

## Funde und Korrekturen

| #   | Fund                                                                                                                         | WCAG          | Stand                                                                                                                                |
| --- | ---------------------------------------------------------------------------------------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| B1  | Fehlerseiten (z. B. 403, 404) ohne Seitentitel, mit englischer Standardseite                                                 | 2.4.2         | behoben: eigene Fehlerseiten mit Titel und Überschrift in einfacher Sprache, im Intranet mit Navigation                              |
| B2  | Dunkle Darstellung: Rot als Schrift (PDF-Symbol, „Löschen“-Knöpfe, Hinweise) mit 2,8:1 bis 3,2:1 zu wenig Kontrast           | 1.4.3, 1.4.11 | behoben: Schrift nutzt die Fehlerfarbe der Darstellung, rote Flächen mit weißer Schrift eine feste Farbe                             |
| B3  | Editor: Knöpfe „H2“, „H3“, „1.“ hießen für Hilfsmittel nur „Überschrift“ usw.; Sprachsteuerung („H2 klicken“) fand sie nicht | 2.5.3         | behoben: sichtbarer Text steht vorn im Namen                                                                                         |
| B4  | Karussell: Knopf „Pause“/„Abspielen“ mit anderem Namen für Hilfsmittel                                                       | 2.5.3         | behoben                                                                                                                              |
| B5  | Zielgröße unter 24 px: Namen, E-Mail- und Telefon-Links in Abteilungen, Links in der Fußzeile                                | 2.5.8         | behoben: mindestens 24 px hoch                                                                                                       |
| B6  | Waagerecht scrollbare Bereiche nicht per Tastatur erreichbar: PDF-Vorschau, Protokoll, Liste der Sicherungen                 | 2.1.1         | behoben: fokussierbar, als Bereich benannt                                                                                           |
| B7  | Bei 320 px Breite stand die Seite über (Verwaltung, Konto, Mandant bearbeiten): Spalten mit fester Mindestbreite             | 1.4.10        | behoben: Mindestbreiten höchstens so breit wie der Platz (alle Raster)                                                               |
| B8  | Betreiber-Bereich ohne Hauptüberschrift                                                                                      | 1.3.1, 2.4.6  | behoben                                                                                                                              |
| B9  | Schalter „Aktiv“ bei Standorten ohne `role="switch"` (wie die übrigen Schalter)                                              | 4.1.2         | behoben                                                                                                                              |
| B10 | Bilder in Beiträgen, am Schwarzen Brett und „Hinter den Kulissen“ nur mit allgemeinem Alternativtext („Foto 1 von 3 zu …“)   | 1.1.1         | behoben (0.10.0): beim Hochladen optional eine Bildbeschreibung, höchstens 250 Zeichen; ohne Beschreibung weiter der allgemeine Text |

Nach den Korrekturen meldet axe auf keiner geprüften Seite einen Verstoß, in Hell, Dunkel und bei 320 px. Keine Seite steht bei 320 px waagerecht über.

## Stand je Anforderung (Kap. 17)

| Anforderung                                     | Stand                                                                                                                                                                        |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Per Tastatur bedienbar, sichtbarer Fokus        | erfüllt: Fokusrahmen 3 px für alle Bedienelemente, „Zum Inhalt springen“, Dialoge mit Fokusführung (Bestätigungen als `alertdialog`, Fokus zurück auf den auslösenden Knopf) |
| Fokus nicht verdeckt                            | erfüllt: `scroll-padding-top` unter der festen Kopfzeile, geprüft                                                                                                            |
| Zielgröße mindestens 24 × 24 px                 | erfüllt (B5); Links im Fließtext sind nach WCAG ausgenommen                                                                                                                  |
| Kontrast 4,5:1 in Hell und Dunkel               | erfüllt (B2); Farben der Mandanten prüft die Verwaltung beim Speichern (mindestens 4,5:1)                                                                                    |
| Überschriften, Bereiche, Beschriftungen         | erfüllt: genau eine `h1` je Seite (B1, B8), Formulare beschriftet                                                                                                            |
| Schalter als `switch`, Auswahl als `radiogroup` | erfüllt (B9)                                                                                                                                                                 |
| Statusmeldungen über Live-Regionen              | erfüllt: Meldungen mit `role="status"` bzw. `role="alert"`                                                                                                                   |
| „Bewegung reduzieren“                           | erfüllt: Übergänge, Karussell und Führung halten an                                                                                                                          |
| Bilder                                          | erfüllt (B10): Bildbeschreibung beim Hochladen, sonst allgemeiner Text                                                                                                       |
| PDFs                                            | Hinweis unter jeder Vorschau, dass die Barrierefreiheit von der Quelle abhängt; Download immer möglich                                                                       |
| Umbruch bei 400 % Zoom (320 px)                 | erfüllt (B7)                                                                                                                                                                 |

## Offene Punkte

- **Test mit Bildschirmleser** (NVDA mit Firefox, VoiceOver auf iPhone) und mit betroffenen Beschäftigten, z. B. über die Schwerbehindertenvertretung.
- **Inhalte**: PDFs sollten barrierefrei erstellt werden; das Handbuch („Beitrag schreiben“) gibt dazu Hinweise.
- Die Prüfung nach größeren Änderungen an der Oberfläche wiederholen.
