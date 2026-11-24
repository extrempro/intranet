# Intranet – Spezifikation

Stand: 18.11.2026 · Grundlage: klickbarer Entwurf „Intranet-PWA“ (Main, Login, Betreiber) und die Entscheidungen aus der Entwurfsphase.

Diese Spezifikation beschreibt, **was** das Intranet können soll und **welche Regeln** gelten. Wie es technisch umgesetzt wird, steht nur dort, wo es eine Entscheidung gibt (Stack, Betrieb, Sicherheit). Werte, die in der Verwaltung einstellbar sind, stehen mit ihrem **Standardwert** dabei.

Kennzeichnung:

- **Muss** – entschieden, gehört zum Umfang.
- **Vorschlag** – sinnvoll, aber noch nicht ausdrücklich bestätigt.
- **Zurückgestellt** – entschieden, später umzusetzen.

---

## 1. Rahmen

### 1.1 Zweck

Ein gemeinsames Intranet für mehrere Mandanten (Häuser) mit Neuigkeiten, Organisation, Wissen und Service. Es läuft als Progressive Web App (PWA) im Browser und auf dem Handy und ist installierbar.

### 1.2 Begriffe

| Begriff      | Bedeutung                                                                                                |
| ------------ | -------------------------------------------------------------------------------------------------------- |
| Mandant      | Ein Haus bzw. eine Gesellschaft. Jede Person gehört genau einem Mandanten an.                            |
| Hauptmandant | Der Mandant, zu dem die zentralen Einheiten gehören.                                                     |
| Zentral      | Eine Einheit, die für alle Mandanten zuständig ist (z. B. Personal, IT, kaufmännische Geschäftsführung). |
| Einheit      | Oberbegriff für Geschäftsführung, Stabsstelle, Abteilung und Hub.                                        |
| Hub          | Themen- oder Interessengruppe quer zu den Abteilungen (z. B. „Neu im Haus“).                             |
| Spielzeit    | Geschäftsjahr, 01.08. bis 31.07.                                                                         |
| KBB          | Künstlerisches Betriebsbüro. Es gibt mehrere, je Mandant.                                                |
| Betreiber    | Externe Kantinenbetreiber, die den Speiseplan ihres Standorts pflegen.                                   |

### 1.3 Verbindliche Anforderungen

- **Muss** DSGVO: Datensparsamkeit, Löschfristen (Kap. 15), keine Weitergabe an Dritte außer den genannten Diensten.
- **Muss** Barrierefreiheit nach WCAG 2.2, Stufe AA (Kap. 17).
- **Muss** Sicherheit nach OWASP ASVS (aktuelle Version), Level 2 (Kap. 16).
- **Muss** Sprache Deutsch, Ansprache durchgehend mit „du“ (auch in der Oberfläche für Betreiber und bei der Anmeldung).
- **Muss** Hell- und Dunkelmodus, Umschalter in der Kopfzeile.

### 1.4 Technik und Betrieb (entschieden)

- SvelteKit mit TypeScript, PostgreSQL mit Drizzle ORM.
- Betrieb in Docker hinter einem Reverse Proxy, fertige Images aus der GitHub Container Registry.
- Repo `extrempro/intranet`, öffentlich, Lizenz MIT.
- Alle Dateien (Anhänge, PDFs, Profilfotos) werden **verschlüsselt** gespeichert und nur nach Anmeldung ausgeliefert.

---

## 2. Grundprinzipien

1. **Rechte bestimmen, was man sieht.** Knöpfe zum Anlegen, Bearbeiten, Hochladen und Löschen sind überall nur für Personen sichtbar, die das passende Recht haben. Die Prüfung erfolgt zusätzlich immer auf dem Server.
2. **Anlegen nur über einen Knopf.** Es gibt keine dauerhaft offenen Eingabemasken; Inhalte werden über „… erstellen“ / „… hochladen“ angelegt.
3. **Mandantentrennung.** Personen sehen nur Inhalte ihres Mandanten und die zentralen Inhalte. Abteilungen anderer Mandanten sind nicht sichtbar. Es gibt keinen globalen Mandanten-Umschalter. Ausnahmen sind ausdrücklich genannt (Hinter den Kulissen, Schwarzes Brett, Kalender).
4. **Direkt verlinkbar.** Beiträge, Vereinbarungen, Seiten und Termine haben eine eigene Adresse.
5. **Erklärungen am Ort.** Ein „i“ neben Feldern und Einstellungen öffnet eine kurze Erläuterung.
6. **Hilfe bleibt aktuell.** Führung, Seiten-Einführungen und Handbuch werden bei jeder Änderung mit angepasst.
7. **Sparsame Voreinstellungen** bei Benachrichtigungen.

---

## 3. Mandanten und Organisation

### 3.1 Mandanten

- Name, Kürzel, Mandanten-Admins, Branding (Logos für hell und dunkel, Akzent- und Hintergrundfarbe, App-Symbol und Favicon).
- **E-Mail-Domains**: Der Mandant einer Person wird immer aus der Domain ihrer E-Mail-Adresse abgeleitet.
- **Leitung je Mandant** (Auswahl aus Einheiten vom Typ Geschäftsführung):
  - Künstlerische Leitung, z. B. Intendanz oder Generalmusikdirektion.
  - Kaufmännische Geschäftsführung. Ist bei allen Mandanten dieselbe Einheit eingetragen, gilt sie als zentral.
- **Zuordnungen**: KBB des Mandanten, Interessenvertretung (Verweis auf eine Seite im Intranet).
- **Startseite für neue Personen**: Reihenfolge und Sichtbarkeit der Startseiten-Karten (Kap. 7).

### 3.2 Einheiten

| Typ              | Beschreibung                                |
| ---------------- | ------------------------------------------- |
| Geschäftsführung | Leitung eines Mandanten oder zentral.       |
| Stabsstelle      | Immer für alle Mandanten zuständig.         |
| Abteilung        | Gehört zu einem Mandanten oder ist zentral. |
| Hub              | Themengruppe, eigene Regeln (Kap. 8.12).    |

- **Titel (Freitext, optional)** für Geschäftsführung und Stabsstelle, z. B. „Intendanz“, „Kaufmännischer Direktor“, „Datenschutzbeauftragte“. Erscheint statt der Typbezeichnung auf der Seite, in Listen und in der Suche. Rechte, Gruppierung und Auswahl hängen weiter am Typ.
- **Ausgeblendet**: erscheint nicht in Listen und Suche.
- Den **Typ** legt die Verwaltung beim Anlegen fest.
- **Leitung, Stellvertretung und zweite Leitung** (gleichrangig, für Doppelspitzen) pflegt jede Einheit selbst auf ihrer Seite, jeweils als Auswahl aus dem eigenen Team.
- Betriebsrat und Personalrat sind normale Abteilungen. Einladungen zur Betriebsversammlung kommen vom Betriebsrat.
- Einheiten ohne eigene Pflegeperson werden von der **Redaktion** gepflegt (Kap. 10).

### 3.3 Organigramm

- **Muss** Ein gemeinsames Organigramm für alle Mandanten als **PDF**, direkt angezeigt (Zoom −/+, Einpassen) und herunterladbar.
- „Neue Fassung hochladen“ mit Angabe des Stands (Monat); die alte Fassung wird ersetzt.
- Hochladen dürfen alle mit der Rolle **Organigramm pflegen** (beliebig viele Personen).
- Es gibt **keine** im Intranet gezeichnete Darstellung und keine Strukturpflege (verworfen).

---

## 4. Konten und Anmeldung

### 4.1 Microsoft Entra ID

- Anmeldung per OpenID Connect; Zugang über eine Entra-Gruppe.
- MFA und bedingter Zugriff werden in Entra geregelt.
- **Abgleich** von Profil, Gruppen und Mandant bei jeder Anmeldung und nächtlich (Standard 02:30 Uhr). In Entra deaktivierte Konten werden gesperrt.
- **Rollen aus Entra-Gruppen**: Zuordnung Gruppe → Rolle (+ Geltungsbereich), z. B. `GRP-INTRANET-REDAKTION` → Redaktion · alle Mandanten.
- Microsoft Graph wird mit den nötigsten Berechtigungen genutzt (Profile, Gruppen, Teams-Nachrichten).
- **In der Teams-App** per Single Sign-on: Teams gibt der App ein Token (Scope `access_as_user`), der Server tauscht es gegen ein Graph-Token (On-Behalf-Of) und gleicht ab wie bei der normalen Anmeldung. Lokale Konten nutzen das Intranet im Browser.

### 4.2 Lokale Konten

Für Personen ohne Microsoft-Konto. Angelegt durch die Verwaltung per Einladung.

- **Zweiter Faktor Pflicht**: Authenticator-App (TOTP) oder Passkey.
- **Wiederherstellungscodes**: 10 Einmalcodes, im Konto neu erzeugbar.
- **Passwortrichtlinie** (Standardwerte):
  - mindestens 12 Zeichen, bis 128 erlaubt, Leerzeichen erlaubt (Passphrasen)
  - keine Pflicht zu Zeichenarten, kein regelmäßiger Wechsel
  - Einfügen erlaubt (Passwortmanager), Stärkeanzeige
  - **Prüfung gegen bekannte Passwörter** über Have I Been Pwned (k-Anonymität: nur die ersten 5 Zeichen des SHA-1-Hashwerts werden übertragen). Ist der Dienst nicht erreichbar, wird das Passwort angenommen und der Vorfall protokolliert.
- **Verzögerung** ab 5 Fehlversuchen mit wachsender Wartezeit, keine dauerhafte Sperre.
- **Abmelden nach Inaktivität**: einstellbar (30 Minuten / 8 Stunden / 7 Tage).
- **Link zum Zurücksetzen**: gültig 15 / 30 / 60 Minuten (einstellbar).

### 4.3 Betreiber-Konten

Konten der Kantinenbetreiber werden unter **Standorte** verwaltet, erscheinen nicht in der Benutzerliste und haben eine eigene, schlanke Oberfläche (Speiseplan, Öffnungs- und Schließzeiten nur ihres Standorts).

### 4.4 Sitzungen

Im Konto sichtbar und einzeln beendbar. In der Teams-App gilt ein eigenes Sitzungs-Cookie (SameSite=None, partitioniert): Es gilt nur, wenn das Intranet unter Teams eingebettet ist. Eingebettet werden darf das Intranet nur in Teams, Outlook und Microsoft 365.

### 4.5 Einrichtung und Notfallzugang

- **Ersteinrichtung ohne Microsoft**: Gibt es keinen aktiven System-Admin, schreibt die Anwendung beim Start einen einmaligen Link ins Log (24 Stunden gültig, jeder Neustart erzeugt einen neuen). Darüber werden der Hauptmandant (Name, Kürzel, Domains, Farben) und der erste System-Admin als lokales Konto mit zweitem Faktor angelegt.
- System-Admins werden nicht automatisch aus Entra abgeleitet, sondern im Intranet vergeben (von Hand oder über „Rollen aus Entra-Gruppen“).
- **Notfallzugang**: Ein Befehl im Container (`node scripts/notfall-admin.mjs`) erzeugt einen Link für einen weiteren lokalen System-Admin, z. B. wenn die Anmeldung mit Microsoft nicht geht. Protokolliert.

---

## 5. Rollen und Rechte

### 5.1 Rollen

| Rolle                      | Geltungsbereich   | Darf                                                                                                                                                         |
| -------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Redaktion                  | Mandant oder alle | Sieht geplante Beiträge aller Absender, darf an mehrere Mandanten pushen, mehr anheften; pflegt Einheiten ohne eigene Pflege; Bereich „Redaktion“ (Kap. 10). |
| Abteilungsverwaltung       | je Abteilung      | Pflegt Seite, Team, Zuständigkeiten; vergibt Schreibrechte; schaltet „Hinter den Kulissen“ für die Abteilung frei.                                           |
| Hub-Team                   | je Hub            | Pflegt den Hub gemeinsam; Koordination durch eine Person möglich; vergibt Schreibrechte; kann den Hub ruhen lassen.                                          |
| Organigramm pflegen        | alle Mandanten    | Lädt neue Fassungen des Organigramms hoch.                                                                                                                   |
| Vereinbarungen pflegen     | je Mandant        | Stellt Betriebs- und Dienstvereinbarungen ein. Auch an Personen außerhalb von Betriebsrat/Personalrat vergebbar.                                             |
| Fachpflege                 | je KBB            | Lädt Pläne des KBB hoch und löscht sie.                                                                                                                      |
| Moderation Schwarzes Brett | je Mandant        | Prüft neue und gemeldete Anzeigen, stellt Rückfragen.                                                                                                        |
| Mandanten-Admin            | je Mandant        | Verwaltet den eigenen Mandanten: Branding, Benutzer, Standorte.                                                                                              |
| System-Admin               | alle              | Verwaltet alles, auch Anmeldung, Regeln und System. Sparsam vergeben.                                                                                        |
| Betreiber                  | je Standort       | Externe; Speiseplan und Standort-Infos.                                                                                                                      |

Eine eigene Rolle „Autor“ gibt es nicht. Schreibrechte werden je Person delegiert (5.2).

### 5.2 Delegierte Schreibrechte

- Abteilungsverwaltung bzw. Hub-Team vergibt je Person einzeln: **Neuigkeiten**, **FAQs**, **Termine**, **Hinter den Kulissen**, **Mediathek**, **Umfragen** (Hubs: Neuigkeiten, FAQs, Termine, Dokumente, Mediathek, Umfragen).
- Höchstens **10 Personen** mit mindestens einem Schreibrecht je Einheit (einstellbar). Abteilungsverwaltung und Hub-Team zählen nicht mit.
- **Team pflegen:** Personen holen Verwaltung und Pflege-Rolle (Abteilungsverwaltung in Abteilungen, Geschäftsführung und Stabsstellen; Hub-Team in Hubs) selbst ins Team und entfernen sie wieder. Personen mit Pflege-Rolle entfernt in Abteilungen nur die Verwaltung.
- **Personensuche beim Hinzufügen** (Live-Suche nach Name oder E-Mail): Personen im Intranet und, wenn Entra eingerichtet ist, Mitglieder der Zugangsgruppe, die sich noch nie angemeldet haben (Graph durchsucht dabei nur den Anzeigenamen). Nur der eigene Mandant, bei zentralen Hubs alle. Wird eine Person aus Entra gewählt, legt das Intranet ihr Konto gleich an – mit Mandant und Rollen wie bei der Anmeldung, ohne Anmeldezeitpunkt; mit lokalem Konto gleicher E-Mail-Adresse wird nicht zusammengeführt. Kontakte in Hubs suchen nur unter Personen im Intranet.
- Als Absender erscheint immer die Einheit, nie die Person.

### 5.3 Sichtbarkeit

Siehe Grundprinzip 1. Alle Rechte werden serverseitig geprüft, Mandantengrenzen inklusive.

---

## 6. Navigation und Seitenaufbau

### 6.1 Bereiche

| Bereich      | Unterseiten (Reihenfolge)                                                                          |
| ------------ | -------------------------------------------------------------------------------------------------- |
| Start        | Startseite                                                                                         |
| Aktuelles    | Neuigkeiten, Pläne (KBB), Kalender, Aus den Hubs, Hinter den Kulissen, Schwarzes Brett, Speiseplan |
| Organisation | Abteilungen, Hubs, Personen, Organigramm                                                           |
| Wissen       | FAQs, Rechtliches, Handbuch                                                                        |

### 6.2 Darstellung je Gerät

- **PC (ab 1024 px)** und **Tablet**: Hauptmenü links. Ausgeklappt mit Bereichen, deren Unterseiten sich auf- und zuklappen lassen (mehrere offen); eingeklappt nur Symbole, ein Klick zeigt die Unterseiten daneben. Ohne gemerkten Stand ist es auf dem PC aus-, auf dem Tablet eingeklappt; gemerkt wird je Gerät. Eingeklappt stehen die Unterseiten zusätzlich als Reiter über dem Inhalt („Mehr ▾“ für den Rest).
- **Handy**: Leiste unten; ein Bereich öffnet zuerst eine Übersicht. Oben ein Knopf „Bereich · Unterseite – Wechseln“, der die Liste der Unterseiten von unten öffnet. Zurück-Pfeil oben links.

### 6.3 Kopfzeile

Suche, Hell/Dunkel, Rückmeldung (Daumen, öffnet ein Fenster), **Nachrichten** (Fach mit Zähler), **Glocke** (Zähler), Konto-Menü.

### 6.4 Konto-Menü

Mein Konto, Redaktion (nur mit Rolle), Verwaltung (nur Admins), Handbuch, Führung erneut starten, Rückmeldung geben, Abmelden.

### 6.5 Bestätigungen (Design-Regel)

Jede Rückfrage vor einer Aktion („… löschen?“, „Konto sperren?“) erscheint als **eigenes Fenster**, nie als Zeile im Formular. Umsetzung: `MitFrage.svelte` (Knopf mit Rückfrage und Formular) bzw. `frage()` aus `src/lib/frage.svelte.ts`, angezeigt von `FrageDialog.svelte`.

### 6.6 Rückmeldungen immer sichtbar (Design-Regel)

Rückmeldungen nach einer Aktion („Gespeichert.“, Fehler, Hinweise) müssen auf PC, Tablet und Handy **immer zu sehen** sein, auch auf langen Seiten. Sie stehen als `.meldung` mit `role="status"` (Erfolg) oder `role="alert"` (Fehler) beim Bereich, um den es geht. Liegt eine solche Meldung außerhalb des sichtbaren Bereichs, zeigt `MeldungImBlick.svelte` (im Layout) sie zusätzlich unten im Fenster an, auf dem Handy über der Leiste unten: Erfolg verschwindet nach 6 Sekunden, Fehler erst beim Schließen; ein Klick springt zur Meldung. Neue Seiten brauchen dafür nichts weiter, solange sie diese Klassen und Rollen verwenden.

- **PC und Tablet**: Fenster in der Mitte, Titel als Frage, ein Satz, was passiert; rechts „Abbrechen“ und der Bestätigungsknopf mit dem Verb („Löschen“, „Sperren“).
- **Handy**: Fenster von unten, große Knöpfe über die ganze Breite, Bestätigen oben.
- **Endgültiges** (Löschen, Sperren, Entziehen): Bestätigungsknopf rot, Fokus zuerst auf „Abbrechen“.
- Escape oder ein Klick daneben bricht ab; danach steht der Fokus wieder auf dem Knopf, der gefragt hat.
- Einzelne, leicht rückgängig zu machende Aktionen (z. B. ein Abo beenden, Favorit entfernen) brauchen keine Rückfrage; alles, was Daten löscht, Rechte entzieht oder andere abmeldet, schon.

### 6.7 Lange Listen (Design-Regel)

Listen, die mit der Zeit wachsen (Neuigkeiten, Pläne, Mitglieder, Mediathek …), werden **nie still abgeschnitten**. Wer nicht alles sieht, erfährt, wie viel es gibt, und kommt weiter.

- **Zähler** über der Liste: „20 von 67 Beiträgen“.
- **Weiter** unter der Liste: Knopf „20 ältere laden · noch 47“ (bei Personen „24 weitere anzeigen“, dazu „Alle n anzeigen“). Kein Endlos-Scrollen, keine Seitenzahlen. Am Ende steht „Das waren alle 67 Beiträge.“ und „Nach oben“.
- Der Stand steht in der Adresse (`?anzahl=40`), „Zurück“ führt an dieselbe Stelle; ohne JavaScript ist der Knopf ein normaler Link.
- Nach dem Laden steht der Fokus auf dem ersten neuen Eintrag; Screenreader hören „20 weitere geladen“.
- **Gliedern**: zeitliche Listen nach Monat („November 2026 · 12 Beiträge“), Personen nach Anfangsbuchstaben des Nachnamens. Zeiträume (Pläne, Termine): Aktuell und Demnächst als Kacheln oben, darunter das Archiv mit Jahr-Chips („2025 · 325“).
- Personenlisten: Leitung und Redaktion oben, dann Suche, dann alle Mitglieder.
- **Ansicht**: Listen mit großen Karten haben neben der Suche einen Umschalter mit zwei Symbolen, **Ausführlich** und **Kompakt** (Tooltip und `aria-label` „Ansicht: …“). Kompakt: kleinerer Titel, eine Zeile Auszug, kleine Vorschau, ohne „Weiterlesen“ und Zielgruppen-Schild; auf dem Handy ohne Vorschau. Die Wahl gilt je Person auf allen Geräten.

|                   | PC (ab 1024 px)                     | Tablet (600–1023 px)      | Handy (unter 600 px)                          |
| ----------------- | ----------------------------------- | ------------------------- | --------------------------------------------- |
| Suche, Ansicht    | eine Zeile, Umschalter rechts       | wie PC                    | Suche schmaler, Umschalter in derselben Zeile |
| Filter, Zähler    | Chips in einer Zeile, Zähler rechts | wie PC                    | Chips umbrechen, Zähler darunter              |
| Karten            | Vorschau rechts                     | Vorschau rechts, schmaler | Vorschau oben, eine Spalte                    |
| Kacheln, Personen | 3 bzw. 4 Spalten                    | 2 Spalten                 | 1 Spalte                                      |
| Weiter-Knopf      | mittig, mind. 260 px breit          | wie PC                    | volle Breite, mind. 44 px hoch                |

---

## 7. Startseite

1. Begrüßung mit Mandant und Datum; Knopf **„Startseite anpassen“**.
2. **Dringende Meldungen** als rotes Banner (Kap. 8.2).
3. **Favoriten**: Symbol-Kacheln (auf dem Handy vier je Reihe), höchstens 8; die Beschreibung steht im Tooltip. Hinzufügen per Stern ☆ auf der jeweiligen Seite. Neue Personen bekommen die Standard-Favoriten ihres Mandanten (Verwaltung → Mandanten → Startseite für neue Personen).
4. **Aktuelle Pläne** (KBB) als eigene Leiste unter den Favoriten, auf dem Handy als Liste vor den Favoriten.
5. **Für dich**: Neuigkeiten, Heute und morgen, Neu in deinen Hubs, Speiseplan.
   - PC: Neuigkeiten links mit Aufmacher (angeheftet mit Bild, sonst neuester mit Bild, sonst neuester) und drei weiteren Beiträgen mit Mini-Vorschau; ungelesene Beiträge (seit dem letzten Besuch von Neuigkeiten) mit Punkt. Die übrigen Karten rechts; leere Karten werden ausgeblendet, sind alle leer, steht dort „So geht es los“.
   - Handy: eine Karte „Für dich“ mit vier gleich breiten Bereichen (Neues, Termine, Hubs, Kantine) zum Umschalten; die Zahl am Bereich Neues zeigt ungelesene Beiträge.

**Startseite anpassen**: Karten ein-/ausblenden und mit ↑ ↓ sortieren; im selben Modus Favoriten mit ← → sortieren und mit × entfernen. „Auf Standard zurücksetzen“ führt zum Standard des Mandanten (Verwaltung → Mandanten). Die Einstellung gilt für das Konto, also auf allen Geräten. Dringende Meldungen und Favoriten stehen immer oben.

---

## 8. Inhalte

### 8.1 Neuigkeiten

- **Absender**: Geschäftsführung, Stabsstellen, Abteilungen. Hub-Beiträge stehen getrennt (8.3).
- **Entwürfe** (auch Hub-Beiträge, Hinter den Kulissen, FAQs): neue Einträge werden beim Schreiben automatisch (wenige Sekunden nach der letzten Änderung) und per Knopf als Entwurf gespeichert; nur für die eigene Person sichtbar (Row-Level Security), Liste „Meine Entwürfe“; nach dem Veröffentlichen gelöscht, sonst 90 Tage nach der letzten Änderung. Hochgeladene Bilder und Anhänge eines Entwurfs bleiben so lange erhalten.
- **Schutz vor Verlassen**: In allen Formularen fragt das Intranet vor dem Verlassen nach, wenn Eingaben weder abgeschickt noch als Entwurf gesichert sind (Fenster nach 6.5; beim Schließen oder Neuladen fragt der Browser).
- **Freigabe** (geplant veröffentlichen) und **Ablaufdatum**. Geplante Beiträge sehen die Schreibenden der Einheit und die Redaktion (Filter „Geplant“).
- **Zielgruppe („Wer sieht das?“)**: Nicht-zentrale Einheiten veröffentlichen nur für den eigenen Mandanten; zentrale Absender wählen alle oder einzelne Mandanten. Standortbezogene Beiträge sehen nur Personen mit diesem Standort.
- Veröffentlichung **ohne Redaktionsfreigabe**.
- **WYSIWYG-Editor** (fett, kursiv, unterstrichen, H2/H3, Listen, Zitat, Link, einfache Tabellen mit Kopfzeile ohne verbundene Zellen, Infokasten Info/Hinweis/Warnung), **Dateianhänge** (verschlüsselt). Tabellen und Infokästen gibt es wie Bilder im Text auch bei Hub-Beiträgen, Hinter den Kulissen und FAQs.
- **Bilder im Text** (auch Hub-Beiträge, Hinter den Kulissen, FAQs): JPEG, PNG, WebP; im Browser auf höchstens 1600 px verkleinert, animierte WebP unverändert bis 5 MB. Breite 10–100 % der Textbreite in 5er-Schritten (Anfasser an der Ecke, Schnellwahl klein/mittel/volle Breite, − und +), Ausrichtung links/rechts, verschieben per Ziehen im Text (am Handy immer volle Breite). Bildbeschreibung Pflicht. Höchstens 20 Bilder je Beitrag. Animationen starten angehalten mit Knopf „Abspielen“ (WCAG 2.2.2). Abrufbar nur für Personen, die den Beitrag sehen dürfen.
- **Anheften** (Pflichtfeld „Angeheftet bis“):
  - Höchstdauer 14 Tage
  - pro Absender gleichzeitig 1 (beim nächsten fragt der Editor, ob ersetzt werden soll)
  - Redaktion gleichzeitig 3
  - sichtbar in Neuigkeiten: 3, weitere über „weitere anzeigen“
- **Reaktionen**: bis zu 10 Emojis (Auswahl in der Verwaltung). Gespeichert wird nur, dass jemand reagiert hat; angezeigt wird nur die Anzahl.
- **Filter**: Alle, Meine (eigene Abteilung und gefolgte Einheiten), Geplant; „Von: …“ für einzelne Absender; Suche nur in Neuigkeiten.
- **Benachrichtigen** beim Veröffentlichen gemäß Einstellungen der Lesenden (Kap. 11).

### 8.2 Dringende Meldungen

- Erlaubt für Einheiten mit dem Recht „Dringend“ (Standard: Typen Geschäftsführung, KBB, Betriebsrat; je Einheit in der Verwaltung).
- **Reichweite**: kaufmännische Geschäftsführung (zentral) erreicht alle Mandanten, eine Intendanz nur den eigenen.
- **„Dringend bis“ ist Pflicht**, höchstens 3 Tage; höchstens 1 dringende Meldung je Einheit gleichzeitig (beides einstellbar).
- Anzeige als rotes Banner auf der Startseite unter der Begrüßung; „Gelesen, zuklappen“ je Person.
- **Push wird immer gesendet**; der Editor sperrt „Benachrichtigen“ auf Push und zeigt eine Live-Vorschau sowie „So läuft der Beitrag ab“.
- Nach „Dringend bis“ wird die Meldung zum normalen Beitrag mit Hinweis „War dringend bis …“. Ist ein Ablaufdatum gesetzt, verschwindet sie danach ganz (Ablauf darf nicht vor „Dringend bis“ liegen).
- In Ruhezeiten entscheidet jede Person: „Dringende Meldungen trotzdem sofort“ (Standard an).

### 8.3 Aus den Hubs

- Beiträge der Hubs getrennt von den Neuigkeiten, **Abo je Hub** über eine Glocke.
- Keine Start-Abos; die Verwaltung kann einzelne Hubs als **Pflicht-Abo** setzen (Glocke dann gesperrt mit Schloss).
- Abonnierbar sind Hubs des eigenen Mandanten und zentrale Hubs.

### 8.4 Hinter den Kulissen

- Beiträge von Beschäftigten bzw. Einheiten; gehen ohne Freigabe online. Abgebildete Personen müssen zugestimmt haben (Bestätigung beim Erstellen).
- Einheiten schalten die Funktion selbst frei; Schreibrecht je Person (5.2). Ein kleiner Hinweis „So geht’s“ erklärt die Freischaltung (Text in der Verwaltung editierbar).
- **Mandantenübergreifend**: Schreibende wählen die Ziel-Mandanten, Lesende wählen „Aus: …“; der eigene Mandant ist immer enthalten.
- Bilder im Text wie bei Neuigkeiten (8.1).
- Nicht auf Abteilungsseiten angezeigt.

### 8.5 Schwarzes Brett

- Mandantenübergreifend; Anzeigen erscheinen mit dem Namen der Person.
- Kategorien in der Verwaltung editierbar; „Sonstiges“ ist fest.
- Laufzeit 30 Tage, einmal verlängerbar, höchstens 3 aktive Anzeigen je Person (einstellbar).
- **Kontakt**: immer über „Nachricht“ im Intranet (Kap. 9); zusätzlich optional Teams-Chat, E-Mail oder eigene Angaben.
- **Moderation** je Mandant: neue Anzeigen erst nach Freigabe sichtbar; Gemeldete bleiben sichtbar, bis entschieden ist; wer gemeldet hat, bleibt verborgen. Rückfragen über Nachrichten.
- **Nicht erlaubt**: gewerbliche Anzeigen (bezahlte Dienstleistungen, Handel mit Waren). Private Dinge verkaufen oder verschenken ist erlaubt.
- „Meine Anzeigen“: verlängern, erledigt, löschen. Gespräche mit Interessierten schließen automatisch, wenn die Anzeige abläuft, erledigt oder gelöscht wird.

### 8.6 Pläne (KBB)

- Nur als **PDF**; Liste der Wochen- und Monatspläne je KBB mit „Gültig bis“. Pläne anderer KBBs sind ebenfalls abrufbar, weil sie oft auch für andere Mandanten interessant sind.
- Hochladen und Löschen durch **Fachpflege** des jeweiligen KBB.
- **Offline**: Einzelne Pläne können offline gespeichert werden. Nach dem Wiederverbinden erscheint ein Hinweis, wenn sich ein offline gespeicherter Plan geändert hat.
- Protokolliert werden nur Hochladen und Löschen.
- Zugriff für Externe: **verworfen**.

### 8.7 Speiseplan und Standorte

- Mehrere Standorte mit eigenem Betreiber; der Speiseplan ist ein **PDF** und wird direkt angezeigt. Kein Archiv; Löschung am Tag nach „Gültig bis“.
- Betreiber pflegen Speiseplan sowie Öffnungs- und Schließzeiten ihres Standorts selbst.
- Personen tragen im Konto ihre Standorte ein („Mein Standort“).
- Kein Notfall-Upload durch die Verwaltung.

### 8.8 Kalender

- Quellen: **Spielplan** (zurückgestellt, Kap. 19), **Abteilungen**, **Hubs**. Alle Hub-Termine werden gezeigt, abonnierte sind markiert.
- Ansicht Liste oder Monat; „Quelle ▾“ und „Aus: …“ (weitere Mandanten); der eigene Mandant ist immer enthalten.
- **Termine anlegen** mit dem Recht „Termine“ (5.2). Die Verwaltung legt fest, ob Abteilungen bzw. Hubs überhaupt Termine eintragen dürfen, mit Ausnahme je Einheit.
- **Persönliches iCal-Abo** (Dialog in 3 Schritten): Mandanten, Spielplan ja/nein, Abteilungen (alle/ausgewählte/keine), Hubs (meine Abos/alle/ausgewählte/keine). Der Link ist ohne Anmeldung lesbar, kann gesperrt und neu erzeugt werden; nach 12 Monaten ohne Abruf wird er gesperrt.

### 8.9 FAQs

Je Einheit; Schreibrecht „FAQs“. Frage, Antwort im Editor mit Links, Anhängen und Bildern im Text (wie 8.1). Jede FAQ kann ein oder mehrere **Themen** aus der gemeinsamen Themenliste haben (8.15); die FAQ-Übersicht lässt sich danach filtern.

### 8.10 Rechtliches

- Gesetze und Tarifverträge (einfache Liste) sowie **Betriebs- und Dienstvereinbarungen**.
- Vereinbarungen gelten **je Mandant**, mit Stand, „gilt ab“ und mehreren sortierbaren Anhängen. Keine Entwürfe, keine früheren Fassungen, keine Themen, keine Nummern. Eine neue Fassung ersetzt die alte vollständig.
- Pflege durch die Rolle „Vereinbarungen pflegen“.

### 8.11 Abteilungsseiten

Gilt für Abteilungen, Geschäftsführung und Stabsstellen; Aufbau wie bei Hubs (Kap. 8.12).

- **Übersicht**: oben „Deine Abteilung“ (Stammabteilung und Einheiten, in deren Team du bist), darunter alle Einheiten als Karten (Kürzel, Art, Personen, Zuständigkeiten, Kurzinfo, Mandant, Leitung). Suche nach Abteilung, Thema oder Person (passende Zuständigkeiten stehen oben), Filter nach Mandant, Sortierung „Nach Art“ (Geschäftsführung, Stabsstellen, Abteilungen) oder „A–Z“.
- **Kopf** wie bei Hubs: Art und Zuständigkeit (Mandant/alle), Name, Kurzinfo, Leitung (+ zweite Leitung) und Stellvertretung, Favorit, Link kopieren, Bearbeiten, Team-Gesichter. Darunter Kontakt (Funktionsadresse, Telefon, Sprechzeiten, Raum).
- **Reiter** als eigene Unterseiten: Überblick, Neues, Termine, Dokumente, Videos, Fragen, Über uns & Team. Leere Reiter sehen nur, die sie füllen dürfen.
- **Überblick**: Blöcke **Wer hilft bei was?**, Schnellzugriff, Neues aus der Abteilung, Als Nächstes, Häufige Fragen, Dokumente; daneben „Fragen? Sprich uns an“ (Leitung und Stellvertretung, sonst das Team) und Videos. Für die Pflege „Für dich zum Pflegen“ mit leeren Bereichen.
- **Aufbau, Schnellzugriff und Dokumente** pflegt die Abteilungsverwaltung (bzw. Redaktion ohne eigene Pflege, Verwaltung) unter „Bearbeiten“: Reihenfolge der Reiter, Blöcke im Überblick an/aus und sortieren, bis 12 Schnellzugriff-Kacheln, Dokumente mit Ordnern (wie bei Hubs, Dateien nur nach Anmeldung und Rechteprüfung).
- **Zuständigkeiten**: Suche, Stichwörter, Gruppen, Links; ist eine Person inaktiv, wird die Vertretung angezeigt. Prüf-Erinnerung nach 12 Monaten (einstellbar), Bestätigung mit „Alles geprüft“. Bearbeiten als Akkordeon.
- Leere Felder werden nicht angezeigt.

### 8.12 Hubs

- **Hub beantragen**: Name, Beschreibung, Begründung, Hub-Team, Zuständigkeit. Die Redaktion prüft vor (Rückfrage oder „An Verwaltung geben“); die Verwaltung legt an oder lehnt mit Begründung ab, jederzeit auch ohne Vorprüfung. Rückfragen laufen über Nachrichten; ohne Antwort wird der Antrag nach **30 Tagen** geschlossen (einstellbar).
- **Kopf**: Name, Kurzinfo („Aufgaben in einer Zeile“), Glocke, Favorit, Link kopieren, Bearbeiten, Hub-Team mit Anzahl der Abteilungen; optional **Titelbild** (4:1) und **Symbol** (quadratisch, auch in der Hub-Liste), im Browser zugeschnitten, als JPEG ohne Metadaten.
- **Hinweis oben** (höchstens 200 Zeichen, optional „Anzeigen bis“).
- **Abschnitte**: Schnellzugriff (bis 12 Kacheln mit Titel, Kurzbeschreibung, Symbol; Ziel im Intranet, https, mailto oder tel), Neues zum Thema (Kacheln mit Vorschaubild, „Alle anzeigen“), Termine (mit „In Kalender“), Dokumente und Anleitungen (Ordner, Titel, Beschreibung; bis 300 Dateien), Hub-Team (mit Aufgabe im Hub, Koordination, Abteilung aus dem Profil, Teams-Chat), Ansprechpersonen (bis 20 Personen außerhalb des Teams mit „Wofür zuständig“, ohne Rechte), Häufige Fragen, Über uns (Editor).
- **Reiter als Unterseiten** (`/hubs/<slug>`, `/neues`, `/termine`, `/dokumente`, `/videos`, `/fragen`, `/team`): Leere Reiter sehen nur Personen, die sie füllen dürfen (markiert „leer“); wer direkt auf eine leere Unterseite kommt, sieht einen Platzhalter.
- **Aufbau der Seite** einstellbar: Reihenfolge der Reiter; Blöcke im Überblick (Schnellzugriff, Als Nächstes, Häufige Fragen, Neues zum Thema, Dokumente) sortieren und ein-/ausblenden. Daneben fest: Ansprechpersonen (sonst Hub-Team) und Videos.
- **Bearbeiten** als eine Seite mit einem „Speichern“: Kurzinfo, Koordination, Vorstellung, Wer darf schreiben? (Personensuche, Rechte als Schalter), Hinweis oben, Aufbau, Schnellzugriff („Ziel wählen“: Seite im Intranet, Dokument des Hubs oder Adresse), Dokumente, Termine (direkt anlegen, wenn Hubs Termine haben dürfen), Ansprechpersonen, Hub-Team (Aufgabe, Koordination), Ruhen; dazu Titelbild/Symbol und Archivieren.
- **Pflege**: Hub-Team, Verwaltung und Redaktion (ohne Hub-Team). Das Hub-Team nimmt selbst Personen ins Hub-Team auf (mindestens eine bleibt) und vergibt Rechte: Beiträge, FAQs, Termine, Dokumente. Bei zentralen Hubs aus allen Mandanten.
- **Hub-Übersicht** (`/hubs`):
  - **Deine Hubs** oben (abonnierte und Pflicht-Abos): Symbol, Name, „Letzter Beitrag …“ und „n neu“ seit dem letzten Besuch der Hub-Seite; Link zu „Aus den Hubs“.
  - **Alle Hubs entdecken**: Suche, Sortierung **Aktiv** (Beiträge der letzten 30 Tage), **Beliebt** (Anzahl der Abos), **A–Z**; Chips „Für alle Mandanten“ und je Mandant; Karten mit Symbol (ohne Bild: Anfangsbuchstabe), Abos, Beiträge im Monat, zwei Zeilen Beschreibung und Knopf „Abonnieren“ bzw. „Pflicht-Abo“; 9 je Schritt, „weitere anzeigen“ (Kap. 6.7).
  - **Ruhende Hubs** eingeklappt darunter; am Ende „Dir fehlt ein Thema? Hub beantragen“.
  - Gezählt werden nur Beiträge, die die Person sehen darf. Hubs als Favorit auf der Startseite.
- **Ruhen** (Hub-Team) und **Archivieren** (nur Verwaltung).
- Benachrichtigungen je Hub einstellbar (Kap. 11).

### 8.13 Personen und Kontaktdaten

- Jede Person pflegt selbst: Position, Telefon, Mobil, Raum, Standort (keine Übernahme aus Entra).
- **Mobil**: Sichtbarkeit wählbar – Alle / Nur mein Team (Standard) / Niemand.
- Profilfoto freiwillig, unabhängig von Entra, verschlüsselt gespeichert.

### 8.14 Suche

Globale Suche über Personen, Einheiten, Beiträge, FAQs, Vereinbarungen und Seiten; Ergebnisse nur im Rahmen der Rechte und Mandantengrenzen.

---

### 8.15 Mediathek

Videos wie Schulungen und Anleitungen, für alle Beschäftigten abrufbar, auch mit lokalem Konto. Die Videos liegen im Intranet selbst, nicht in einem externen Videodienst.

- **Zuordnung:** Videos gehören zu einer Abteilung oder einem Hub, wie Neuigkeiten und FAQs. Auf der Seite der Einheit steht ein Abschnitt „Videos“; unter „Wissen“ zeigt die Übersicht alle Videos, die du sehen darfst (Suche in Titel, Beschreibung und Untertiteln; Filter nach Einheit und Thema).
- **Recht:** Schreibrecht „Mediathek“ je Person und Einheit (Kap. 5): hochladen, bearbeiten, veröffentlichen, löschen. In Abteilungen vergibt es die Verwaltung, in Hubs das Hub-Team.
- **Sichtbarkeit** wie bei Neuigkeiten: Videos zentraler Einheiten sehen alle Mandanten (einschränkbar auf einzelne), die übrigen nur der eigene.
- **Themen:** eine gemeinsame Liste für Mediathek und FAQs, gepflegt von System-Admins unter Verwaltung → Themen. Beim Bearbeiten ein oder mehrere Themen wählen; „Thema vorschlagen“ geht an die System-Admins, die aufnehmen oder ablehnen (mit Benachrichtigung). Umbenennen gilt überall; gelöschte Themen verschwinden aus Videos und FAQs (Filter „Ohne Thema“).
- **Hochladen:** MP4, MOV oder WebM, bis 4 GB und 3 Stunden. Das Original liegt nur kurz in einem lokalen Arbeitsordner.
- **Umwandeln:** eigener Container mit ffmpeg (ohne Netz, schreibgeschützt, Grenzen für CPU und Speicher, immer nur eine Umwandlung gleichzeitig) in HLS mit H.264/AAC in 360p, 720p und 1080p, dazu ein Vorschaubild. Danach wird das Original gelöscht (mit ihm eingebettete Angaben wie Ort oder Gerät). Fortschritt sichtbar, Benachrichtigung, wenn fertig.
- **Untertitel automatisch:** Nach dem Umwandeln erzeugt der Dienst `video` deutsche Untertitel mit Whisper (whisper.cpp, Modell large-v3-turbo), lokal ohne Netz. Sie sind als „automatisch erzeugt“ gekennzeichnet und lassen sich beim Bearbeiten Zeile für Zeile korrigieren (Zeiten bleiben). Eigene WebVTT-Dateien ersetzen sie.
- **Vorschlag für Zusammenfassung und Kapitel:** Sobald die Untertitel geprüft sind (oder hochgeladen wurden), kann die bearbeitende Person einen Vorschlag anfordern. Der Dienst `video` erstellt ihn lokal ohne Netz mit llama.cpp und Gemma 4 E4B (QAT, Q4_0) aus den Untertiteln mit Zeitmarken (lange Fassungen gleichmäßig gekürzt). Die Anwendung prüft die Antwort (reiner Text, Kapitel aufsteigend, im Video, erstes bei 0:00) und zeigt sie als Vorschlag. Übernommen wird nur auf Klick: „Als Beschreibung übernehmen“ und „Kapitel übernehmen“, jeweils mit Nachfrage, wenn etwas ersetzt wird. Wenn er fertig ist, gibt es eine Nachricht. Beim Hochladen lässt sich wählen (voreingestellt an), dass der Vorschlag gleich nach den automatischen Untertiteln entsteht; er beruht dann auf ungeprüften Untertiteln und ist so gekennzeichnet. „Neu vorschlagen“ setzt geprüfte Untertitel voraus.
- **Veröffentlichen** nur mit Untertiteln (WebVTT); automatisch erzeugte erst, wenn jemand mit dem Recht sie als „geprüft“ markiert hat. Ausnahme: Das Video braucht bewusst keine Untertitel, mit Grund (kein gesprochener Text, nur Musik oder Geräusche, alles Gesprochene steht als Text im Bild); vorhandene Untertitel werden dann entfernt, eigene Untertitel heben die Ausnahme wieder auf. Bis dahin ist das Video ein Entwurf, sichtbar nur für Personen mit dem Recht.
- **Textfassung und Anhänge** (optional): Text im Editor (ohne Bilder), auf Wunsch aus den Untertiteln übernommen; Anhänge wie bei FAQs. Beim Ansehen unter „Textfassung lesen“ und „Anhänge“.
- **Abbruch beim Hochladen:** Wer hochlädt, kann mit derselben Datei fortsetzen (erkannt an Größe und Prüfsumme des ersten Teils), bis 24 Stunden nach dem letzten Fortschritt.
- **Videodatei ersetzen:** Eine neue Fassung wird hochgeladen und umgewandelt, während das bisherige Video online bleibt; danach werden die Medien getauscht und die alten gelöscht. Kapitel bleiben, soweit sie in die neue Länge passen; hochgeladene Untertitel bleiben, automatisch erzeugte werden neu erzeugt und müssen wieder geprüft werden (bis dahin ist das Video ein Entwurf).
- **Kapitel** (optional), festgelegt nach dem Umwandeln: beim Ansehen „Kapitel hier beginnen“, Liste bearbeiten (Zeit, Titel, löschen, ab hier abspielen) oder als Text einfügen. Geprüft wird: erstes Kapitel bei 0:00, Zeiten aufsteigend und innerhalb der Videolänge, jeder Titel ausgefüllt. Ausgeliefert als WebVTT-Kapitelspur.
- **Ansehen:** eigener Player (hls.js, selbst ausgeliefert) mit Untertiteln (eigener Knopf „Untertitel an/aus“, Wahl im Browser gemerkt), Kapiteln, Geschwindigkeit, ±10 Sekunden, Vollbild und Tastaturbedienung.
- **Für Bearbeiter:** In der Übersicht stehen nicht veröffentlichte Videos getrennt unter „In Arbeit und Entwürfe“. Die Bearbeiten-Seite zeigt links Video und Überblick (Sichtbarkeit, was zum Veröffentlichen noch fehlt; bleibt am PC beim Scrollen stehen), rechts die Schritte 1 Angaben, 2 Untertitel, 3 Kapitel, 4 Textfassung und Anhänge, 5 Veröffentlichen; Ersetzen und Löschen unter „Weitere Aktionen“.
- **Auslieferung:** jedes Stück einzeln verschlüsselt (wie alle Dateien) und nur nach Rechteprüfung, nie über öffentliche oder vorab signierte Adressen.
- **Kein Nachweis:** Es wird nicht ausgewertet, wer was gesehen hat.
- **„Weiter, wo du warst“** (Fortschritt am Konto): je Person und Video nur die Position in Sekunden und das Datum der letzten Änderung; kein Verlauf, nichts im Protokoll. Lesbar nur für die Person selbst (Row-Level Security), keine Ansicht für Admins, Leitungen oder Hub-Teams, kein Export, keine Zahlen. Eintrag wird gelöscht, sobald das Video zu Ende gesehen ist, sonst nach 90 Tagen. Im Konto: Schalter „Fortschritt auf meinem Konto speichern“ (Standard an) und „Meinen Fortschritt löschen“; ist der Schalter aus, bleibt der Fortschritt nur im Browser (Ausschalten löscht den Stand am Konto). Angefangene Videos stehen in der Mediathek unter „Weiter ansehen“. Mitbestimmung nach § 87 Abs. 1 Nr. 6 BetrVG: gehört in die Unterlage für den Betriebsrat.
- **Obergrenze** für den Speicher der Mediathek in der Verwaltung (Kap. 14); ist sie erreicht, sind keine neuen Uploads möglich; ab 90 % werden System-Admins benachrichtigt.

### 8.16 Umfragen

Umfragen hängen an einem Beitrag (Neuigkeiten und Hubs) und stehen im Beitrag unter dem Text.

- **Einschalten in zwei Stufen:** grundsätzlich unter Verwaltung → Regeln für Inhalte → Umfragen, **Standard aus**; zusätzlich je Abteilung bzw. Hub in der Verwaltung („Umfragen freigeschaltet“, **Standard aus**). Neue Umfragen gibt es nur, wenn beides an ist; das Recht „Umfragen“ wird erst dann bei den Schreibrechten angeboten. Wird eins davon ausgeschaltet, laufen vorhandene Umfragen weiter und lassen sich bearbeiten und beenden.
- **Recht:** eigenes Schreibrecht „Umfragen“ je Person und Einheit (Kap. 5.2); Abteilungsverwaltung und Hub-Team haben es immer. Wer es hat, gehört zum „Team von <Einheit>“. Das Recht „Neuigkeiten“ allein reicht nicht.
- **Fragebogen:** 1 bis 15 Fragen, je Frage eine Art und „Pflichtfrage“ ja/nein: **Auswahl** (2–10 Antworten, wahlweise mehrere wählbar), **Terminfindung** (2–10 Termine, je Termin „Passt“, „Vielleicht“, „Passt nicht“), **Bewertung** (1–5 Sterne), **Freitext** (bis 500 Zeichen). Ein Knopf sendet alle Antworten; fehlende Pflichtfragen werden markiert.
- **Anonym** wählbar je Umfrage, **Standard an**. Anonyme Antworten werden ohne Person und ohne Zeitpunkt gespeichert, die Teilnahme getrennt davon (nur, damit niemand doppelt abstimmt). Anonyme Antworten lassen sich nach dem Senden nicht mehr ändern; namentliche bis zum Ende.
- **Wer sieht das Ergebnis:** „Alle Teilnehmenden“ (ab sofort, nach der eigenen Antwort oder erst nach dem Ende) oder „Nur das Team von <Einheit>“. Freitexte sieht immer nur das Team, bei anonymen Umfragen ohne Namen. Verwaltung und zentrale Redaktion sehen Ergebnisse nur, wenn sie zum Team gehören.
- **„Wer sieht was?“** steht im Editor und an der Umfrage: deine Antworten, Ergebnis, Freitexte, Teilnahme, dazu die Namen im Team.
- **Nach der ersten Antwort** sind Fragen, Reihenfolge und „Anonym“ gesperrt; Ende und Sichtbarkeit bleiben änderbar. Entfernen geht dann nicht mehr, nur „Jetzt beenden“.
- **Auswertung** für das Team: Zahlen und Balken, Durchschnitt bei Bewertungen, Freitexte, Export als CSV (bei anonymen Umfragen ohne Namen und in zufälliger Reihenfolge). Export und Änderungen stehen im Protokoll.
- **Startseite:** Karte „Offene Umfragen“ mit laufenden Umfragen, an denen du noch nicht teilgenommen hast; nur sichtbar, wenn es welche gibt.

## 9. Nachrichten

- **Nur Gespräche zu Vorgängen**: Hub-Anträge, Anzeigen am Schwarzen Brett (Moderation und Interessierte), Rückmeldungen. Keine freien Nachrichten zwischen Personen (dafür ist Teams da).
- Eigenes Symbol in der Kopfzeile mit Zähler; die Glocke meldet nur, gelesen und geantwortet wird hier.
- **Postfächer**: Persönlich sowie gemeinsame Postfächer der Rollen Redaktion, Moderation Schwarzes Brett und Verwaltung. Alle mit der Rolle sehen und beantworten dieselben Gespräche.
- Filter Offen/Erledigt; Rollen können Gespräche als erledigt schließen. Oben im Gespräch ein Link zum Vorgang; bei Hub-Anträgen die Antwortfrist.
- Geschlossene Gespräche werden nach der Löschfrist gelöscht.

---

## 10. Bereich Redaktion

Arbeitsliste (keine Einstellungen). Sichtbar mit der Rolle Redaktion; mit der Rolle Moderation Schwarzes Brett nur der Abschnitt Schwarzes Brett.

- Zähler je Abschnitt mit Sprung dorthin.
- **Ohne Pflege**: Einheiten ohne eigene Pflege, Direktsprung zum Bearbeiten. Einheiten mit eigener Pflege bearbeitet die Redaktion nicht.
- **Zu prüfen**: überfällige Zuständigkeiten, bald ablaufende Beiträge, lange nicht geänderte FAQs, inaktive Ansprechpersonen. Einträge verschwinden, sobald erledigt.
- **Dringend und angeheftet**: Überblick über alle Einheiten.
- **Hub-Anträge vorprüfen** (8.12).
- **Schwarzes Brett prüfen**.

---

## 11. Benachrichtigungen

### 11.1 Kanäle

- **Glocke** im Intranet.
- **Web Push** (VAPID). Auf dem iPhone erst nach „Zum Home-Bildschirm“.
- **E-Mail** per SMTP (STARTTLS, TLS oder interner Relay) mit in der Verwaltung festgelegtem Server, Absender (Anzeigename, optional „Antworten an“) und Zugangsdaten; das Passwort wird verschlüsselt gespeichert.
- **Teams**: Das Intranet läuft als App in Teams (persönliche App, per Setup-Richtlinie verteilt; Anmeldung siehe 4.1). Benachrichtigungen erscheinen im Aktivitätsfeed (Graph, Anwendungsberechtigung TeamsActivity.Send) mit Titel, Absender und Link. Ein Klick zeigt im Aktivitätsbereich nur den Hinweis „Es gibt eine neue Benachrichtigung im Intranet“ mit „In der Intranet-App öffnen“ (und „Im Browser öffnen“); erst der Knopf wechselt in die App und öffnet den Beitrag. So läuft das Intranet nicht im Aktivitätsbereich. In Teams hat das Intranet keine eigene Kopfzeile (Teams zeigt App-Name und Symbol); Push gibt es dort nicht. Name, Beschreibung, Herausgeber, Akzentfarbe und Symbol der App sind in der Verwaltung einstellbar; Standard ist das Branding des Hauptmandanten.

### 11.2 Voreinstellungen je Thema

| Thema                         | Glocke                 | Push      | E-Mail | Teams |
| ----------------------------- | ---------------------- | --------- | ------ | ----- |
| Dringende Meldungen           | an (fest)              | an (fest) | an     | an    |
| Angeheftete Beiträge          | an                     | an        | aus    | an    |
| Neuigkeiten                   | an                     | aus       | an     | aus   |
| Hinter den Kulissen           | an                     | aus       | aus    | aus   |
| Speiseplan (eigener Standort) | aus                    | aus       | aus    | aus   |
| Pläne (KBB)                   | an                     | aus       | an     | aus   |
| Schwarzes Brett               | aus                    | aus       | aus    | aus   |
| Nachrichten                   | an                     | an        | an     | an    |
| Hubs                          | je Hub in „Meine Hubs“ |           |        |       |

Teams ist für alle Themen wählbar und wie Push voreingestellt; Hubs nur mit Glocke, Push und E-Mail.

### 11.3 Weitere Einstellungen

- **E-Mail-Zusammenfassung** (Standard täglich): enthält alle Themen mit E-Mail.
- **Ruhezeiten** (Standard an): keine Push- und Teams-Nachrichten, danach gesammelt zugestellt; Glocke und E-Mail nicht betroffen. Je Wochentag einzeln: Zeitraum (auch über Mitternacht), ganztägig oder keine Ruhe; Standard Mo–Fr 20–7 Uhr, Sa+So ganztägig. Ausnahme dringende Meldungen (8.2), Standard an. Ein Satz fasst die Einstellung zusammen.
- **Abwesenheit** (z. B. Urlaub): Zeitraum von–bis (Tage einschließlich, höchstens ein Jahr); keine Push- und Teams-Nachrichten und keine E-Mails, danach gesammelt (Push/Teams ab dem Tag nach der Abwesenheit unter Beachtung der Ruhezeiten, E-Mails mit dem nächsten Versand); Glocke unverändert. Dringende Meldungen nach Wahl (Standard aus). Nur für die Person selbst, für niemanden sonst sichtbar; vorzeitig beendbar.

---

## 12. Konto

Gruppen:

- **Persönlich**: Profil (Foto), Standorte, Kontaktdaten.
- **Benachrichtigungen**: Tabelle (11.2); Meine Hubs; Zusammenfassung; Ruhezeiten.
- **Weitere Einstellungen**: Darstellung, Sicherheit (zweiter Faktor, Passkeys, Wiederherstellungscodes, Sitzungen), Hilfe und Verwaltung (Handbuch, Führung erneut starten, Einführungen wieder anbieten, Rückmeldung, Redaktion, Verwaltung).

---

## 13. Hilfe

- **Führung** beim ersten Start (8 Schritte) mit Hervorhebung und automatischem Scrollen; jederzeit erneut startbar.
- **Einführungen auf Seiten**: Neuigkeiten, Kalender, Schwarzes Brett, Nachrichten (je 3 Schritte). Beim ersten Besuch als Zeile angeboten („Starten“ / „Nein danke“), danach über „?“ neben der Überschrift.
- **Einführungen für Rollen**: Abteilungsverwaltung, Hub-Team, Redaktion, Moderation – einmalig beim ersten Öffnen des Bereichs nach Erhalt der Rolle angeboten.
- **Handbuch** unter Wissen, nach Rolle gefiltert, mit Suche und Kapiteln (Grundlagen, Erstellen, Pflegen, Verwaltung).
- **„i“-Erläuterungen** an Feldern.
- **Rückmeldung** (Daumen, Fenster über der Seite): Fehler oder Idee, mit Angabe der Seite; Stand unter „Meine Meldungen“, Antworten und Rückfragen über Nachrichten. Fehler lesen nur System-Admins; mit technischen Angaben (Version, Fenstergröße, Browser, Teams, letzte Fehlermeldungen des Browsers) und freiwilligem Bildschirmfoto (aufnehmen am PC, auswählen oder einfügen; Vorschau vor dem Senden; 30 Tage nach Abschluss gelöscht). Ideen liest die Verwaltung des Mandanten.
- Bewegungen respektieren „Bewegung reduzieren“ des Systems.

---

## 14. Verwaltung

Nur Mandanten-Admins (eigener Mandant) und System-Admins.

| Bereich              | Inhalt                                                                                                                                                                                                                                                            |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mandanten            | Name, Kürzel, Admins, Domains, Branding, Leitung, KBB, Interessenvertretung, Startseite für neue Personen                                                                                                                                                         |
| Abteilungen und Hubs | Liste mit Filtern (u. a. „Nur ohne Pflege“), Anlegen/Bearbeiten: Typ, Titel, Name, Zuständigkeit, Ausblenden, Pflege, Rechte (Dringend, Termine), Pflicht-Abo                                                                                                     |
| Standorte            | Standorte, Betreiber-Konten                                                                                                                                                                                                                                       |
| Benutzer und Rollen  | Benutzerliste, lokale Konten anlegen/deaktivieren, Rollen mit Geltungsbereich, Rollen aus Entra-Gruppen, Konten für andere ausblenden (Personen, Suche, Profil, Teams, Zuständigkeiten; Anmelden und Rechte bleiben; System- und Mandanten-Admins, protokolliert) |
| Anmeldung            | Entra-Verbindung, Zugangsgruppe, Abgleich, Graph-Berechtigungen; Passwortrichtlinie (4.2)                                                                                                                                                                         |
| Regeln für Inhalte   | Anheften, Dringende Meldungen, Schreibrechte, Kalender, Zuständigkeiten, Hinter den Kulissen, Schwarzes Brett, Hub-Anträge, Reaktionen, Umfragen                                                                                                                  |
| Benachrichtigungen   | Web Push, E-Mail (SMTP), Teams (Meldungen, App-Paket, Aussehen); Status und Testnachricht                                                                                                                                                                         |
| Rückmeldungen        | Eingegangene Fehler und Ideen bearbeiten, beantworten                                                                                                                                                                                                             |
| Speicher             | Speicherorte (lokal, S3-kompatibel), Zuordnung je Inhaltsart, Umzug vorhandener Dateien, Obergrenze der Mediathek (nur System-Admins, siehe 18)                                                                                                                   |
| Löschfristen         | Kap. 15                                                                                                                                                                                                                                                           |
| Protokoll            | Änderungen in der Verwaltung                                                                                                                                                                                                                                      |
| System               | Startklar, Version, Zustand, Sicherungen                                                                                                                                                                                                                          |

Jede Änderung in der Verwaltung wird protokolliert (wer, was, wann; ohne Inhalte von Beiträgen).

---

## 15. Datenschutz und Löschfristen

Standardwerte, in der Verwaltung einstellbar, sofern Optionen angegeben.

| Daten                                 | Frist (Standard)                         | Optionen                  |
| ------------------------------------- | ---------------------------------------- | ------------------------- |
| Anzeigen am Schwarzen Brett           | 30 Tage nach Ablauf/Erledigt/Ablehnung   | sofort, 14, 30, 90 Tage   |
| Vergangene Termine (Abteilungen/Hubs) | 3 Monate                                 | 1 Monat, 3 Monate, 1 Jahr |
| Archivierte Hubs                      | 2 Jahre                                  | 1, 2, 3 Jahre             |
| Geschlossene Gespräche                | 90 Tage                                  | 30, 90 Tage, 1 Jahr       |
| Abgelehnte Hub-Anträge                | 90 Tage                                  | 30, 90 Tage, 1 Jahr       |
| Vergessene Pläne des KBB              | 3 Monate nach „Gültig bis“               | 1, 3, 6 Monate, 1 Jahr    |
| Speisepläne                           | am Tag nach „Gültig bis“                 | –                         |
| Vereinbarungen                        | beim Ersetzen                            | –                         |
| Dateien gelöschter Inhalte            | sofort (Schlüssel wird vernichtet)       | –                         |
| Deaktivierte Konten                   | 90 Tage                                  | 30, 90, 180 Tage          |
| Profilfotos                           | sofort bei Deaktivierung oder auf Wunsch | –                         |
| Reaktionen                            | mit Beitrag bzw. Konto                   | –                         |
| Benachrichtigungen (Glocke)           | 90 Tage                                  | 30, 90, 180 Tage          |
| Protokoll der Verwaltung              | 1 Jahr                                   | 6 Monate, 1, 2, 3 Jahre   |
| Anmeldeprotokoll (gekürzte IP)        | 30 Tage                                  | 7, 30, 90 Tage            |
| Sitzungen                             | sofort nach Ende                         | –                         |
| Kalender-Abo-Links                    | nach 12 Monaten ohne Abruf               | –                         |
| Technische Fehlerprotokolle           | ohne Namen und Inhalte                   | einstellbar               |
| Rückmeldungen                         | nach Abschluss                           | einstellbar               |
| Bildschirmfotos zu Fehlermeldungen    | 30 Tage nach Abschluss                   | –                         |

Weitere Regeln:

- Beiträge gehören der Einheit und bleiben beim Deaktivieren eines Kontos erhalten.
- Reaktionen: nur „hat reagiert“ wird gespeichert, angezeigt nur die Anzahl – auch der Verwaltung.
- Offline zwischengespeicherte Dateien liegen auf dem Gerät und werden beim Abmelden gelöscht.
- Für den Betriebsrat wird eine Unterlage zum Intranet erstellt (Daten, Auswertbarkeit, Protokolle).

---

## 16. Sicherheit (OWASP ASVS Level 2)

- **Authentisierung** nach Kap. 4; Passwörter mit Argon2id gehasht.
- **Sitzungen**: sichere, HttpOnly-, SameSite-Cookies; Abmelden nach Inaktivität; Sitzungen beendbar.
- **Erneute Anmeldung** vor kritischen Verwaltungsaktionen (Rollen vergeben und entziehen, Konten sperren und freigeben, Anmeldung und Entra, SMTP): Microsoft-Konten melden sich neu bei Microsoft an, lokale Konten bestätigen mit dem zweiten Faktor; gilt 10 Minuten. In der Teams-App nicht möglich, dort Link in den Browser.
- **Zugriffskontrolle** serverseitig für jede Anfrage: Rolle, Geltungsbereich und Mandant. Mandantentrennung zusätzlich auf Datenbankebene mit Row-Level Security in PostgreSQL.
- **Eingaben**: Validierung serverseitig; HTML aus dem Editor wird bereinigt; Schutz gegen CSRF; Content Security Policy und übliche Sicherheits-Header.
- **Dateien**: Verschlüsselung je Datei mit eigenem Schlüssel; Schlüssel werden mit einem Hauptschlüssel geschützt; Auslieferung nur nach Rechteprüfung; Typprüfung und Größenlimits beim Hochladen.
- **Ausgehende Verbindungen** nur zu freigegebenen Zielen: Microsoft (Anmeldung, Graph), SMTP-Server, Push-Dienste, `api.pwnedpasswords.com`; später Spielplan-Quelle. Schutz gegen SSRF (nur HTTPS, keine internen Adressen).
- **Protokollierung** sicherheitsrelevanter Ereignisse ohne Inhalte; Anmeldeprotokoll mit gekürzter IP.
- **Abhängigkeiten** werden in der Pipeline auf Sicherheitslücken geprüft; regelmäßige eigene Prüfung der lokal gehosteten Instanz.
- **Begrenzung** von Anfragen (Anmeldung, Zurücksetzen, Hochladen, Nachrichten).

---

## 17. Barrierefreiheit (WCAG 2.2 AA)

- Vollständig per Tastatur bedienbar, sichtbarer Fokus, Fokus nicht verdeckt (z. B. durch feste Kopfzeile).
- Zielgrößen mindestens 24 × 24 px, im Entwurf in der Regel 40–44 px.
- Kontrast mindestens 4,5:1 in Hell und Dunkel.
- Semantische Überschriften (eine Hauptüberschrift je Seite), Bereiche, Beschriftungen; Schalter als `switch`, Auswahlgruppen als `radiogroup`.
- Statusmeldungen über Live-Regionen.
- „Bewegung reduzieren“ wird beachtet.
- Bilder: beim Hochladen optional eine Bildbeschreibung (Alternativtext, höchstens 250 Zeichen); ohne Beschreibung ein allgemeiner Text („Foto 1 von 3 zu …“).
- PDFs: Hinweis, dass die Barrierefreiheit von der Quelle abhängt.
- Prüfung und Stand: `docs/barrierefreiheit.md`.

---

## 18. Betrieb

- Docker Compose: Anwendung, PostgreSQL und Dienst `backup`. Die Images baut GitHub Actions je Release (`ghcr.io/extrempro/intranet`, `…/intranet-backup`); die Version wird über `INTRANET_VERSION` gewählt.
- Erreichbar über einen Reverse Proxy; Bereitstellung mit fertigen Images aus der GitHub Container Registry. Konfiguration über Umgebungsvariablen (keine Secrets im Repo).
- Dateien vom Intranet verschlüsselt, lokal in einem eigenen Volume oder in einem S3-kompatiblen Objektspeicher.
- **Speicher** (Verwaltung → Speicher, nur System-Admins, nach erneuter Anmeldung, protokolliert):
  - Speicherort „Lokal“ ist immer vorhanden. S3-Speicher mit Name, Endpoint, Region, Bucket und Zugangsdaten; der Secret Key wird verschlüsselt gespeichert und nie angezeigt. Endpoint nur per HTTPS und nicht auf interne Adressen (auch nicht nach der Namensauflösung).
  - „Verbindung prüfen“ testet Schreiben, Lesen und Löschen und zeigt, ob die Versionierung im Bucket an ist.
  - Zuordnung je Inhaltsart: Dateien in Inhalten (Anhänge, Bilder, Dokumente), Pläne und Speiseplan, Profilfotos und Bilder der Einheiten, Bildschirmfotos aus Rückmeldungen, Videos der Mediathek. Neue Dateien landen sofort am gewählten Ort.
  - Umzug vorhandener Dateien als Hintergrundauftrag: verschlüsselten Inhalt kopieren, mit Prüfsumme vergleichen, erst dann am alten Ort löschen; Fortschritt sichtbar, Abbruch jederzeit, setzt nach einem Neustart fort.
  - Bucket privat; die Zugangsdaten sollten nur auf diesen Bucket zugreifen. Sicherung im Bucket über Versionierung und Lifecycle-Regel; die Datenbanksicherung enthält nur die Verweise. Für einen externen Speicher ist ein AV-Vertrag nötig.
- **Sicherung** von Datenbank und Dateien: täglich, mit age verschlüsselt, 30 Tage Aufbewahrung, wöchentlicher Wiederherstellungstest; Zustand unter Verwaltung → System.
- **Startklar** (Verwaltung → System) zeigt, ob alles für den Betrieb eingerichtet ist. Schritt für Schritt: `docs/inbetriebnahme.md`.
- Firewall-Freigaben ausgehend siehe Kap. 16.

---

## 19. Zurückgestellt und verworfen

### Zurückgestellt

- **Spielplan-Import per ICS-Abo.** Offen:
  - Woher kommt die Art der Veranstaltung (Premiere, Vorstellung, Gastspiel …): aus der Quelle (Kategorien), per Zuordnung von Kürzeln/Titeln oder von Hand durch das KBB? Im Entwurf sind das nur Beispielwörter.
  - Ein Abo je Mandant oder eines für alle?
  - Abgesagte Vorstellungen markieren oder entfernen?
  - Vorgesehen: Abruf durch den Server im Intervall, Wiedererkennung über die UID, Zeitfenster, Termine im Intranet nur lesbar, Adresse verschlüsselt gespeichert.

### Verworfen

- Zugriff für Externe auf die Pläne des KBB
- Urlaubsbeantragung
- Organigramm als eigene Darstellung im Intranet, Strukturpflege („Gehört zu“, „Nur im Organigramm“, Beziehungen) und Rolle „Organisation pflegen“
- Notfall-Upload des Speiseplans durch die Verwaltung
- Gemeinsame Einheit „Geschäftsführung“ (ersetzt durch künstlerische Leitung und kaufmännische Geschäftsführung)

---

## 20. Umsetzung

Alle Etappen sind umgesetzt (Anmeldung und Verwaltung; Benachrichtigungen, FAQs, Kalender, Pläne, Speiseplan; Hubs, Hinter den Kulissen, Schwarzes Brett, Nachrichten, Redaktion; Führung, Handbuch, Sicherheitsprüfung, Teams-App). Änderungen seitdem stehen in `CHANGELOG.md` und unter „Neu im Intranet“.
