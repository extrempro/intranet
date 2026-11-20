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
| Begriff | Bedeutung |
|---|---|
| Mandant | Ein Haus bzw. eine Gesellschaft. Jede Person gehört genau einem Mandanten an. |
| Hauptmandant | Der Mandant, zu dem die zentralen Einheiten gehören. |
| Zentral | Eine Einheit, die für alle Mandanten zuständig ist (z. B. Personal, IT, kaufmännische Geschäftsführung). |
| Einheit | Oberbegriff für Geschäftsführung, Stabsstelle, Abteilung und Hub. |
| Hub | Themen- oder Interessengruppe quer zu den Abteilungen (z. B. „Neu im Haus“). |
| Spielzeit | Geschäftsjahr, 01.08. bis 31.07. |
| KBB | Künstlerisches Betriebsbüro. Es gibt mehrere, je Mandant. |
| Betreiber | Externe Kantinenbetreiber, die den Speiseplan ihres Standorts pflegen. |

### 1.3 Verbindliche Anforderungen
- **Muss** DSGVO: Datensparsamkeit, Löschfristen (Kap. 15), keine Weitergabe an Dritte außer den genannten Diensten.
- **Muss** Barrierefreiheit nach WCAG 2.2, Stufe AA (Kap. 17).
- **Muss** Sicherheit nach OWASP ASVS (aktuelle Version), Level 2 (Kap. 16).
- **Muss** Sprache Deutsch, Ansprache durchgehend mit „du“ (auch in der Oberfläche für Betreiber und bei der Anmeldung).
- **Muss** Hell- und Dunkelmodus, Umschalter in der Kopfzeile.

### 1.4 Technik und Betrieb (entschieden)
- SvelteKit mit TypeScript, PostgreSQL mit Drizzle ORM.
- Betrieb in Docker, erreichbar über den NetBird Reverse Proxy, Bereitstellung per Arcane Git-Sync.
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
- Name, Kürzel, Mandanten-Admins, Branding (Logo, Akzentfarbe).
- **E-Mail-Domains**: Der Mandant einer Person wird immer aus der Domain ihrer E-Mail-Adresse abgeleitet.
- **Leitung je Mandant** (Auswahl aus Einheiten vom Typ Geschäftsführung):
  - Künstlerische Leitung, z. B. Intendanz (Hauptmandant, Mandant B) oder Generalmusikdirektor (Mandant C).
  - Kaufmännische Geschäftsführung. Ist bei allen Mandanten dieselbe Einheit eingetragen, gilt sie als zentral.
- **Zuordnungen**: KBB des Mandanten, Interessenvertretung (Verweis auf eine Seite im Intranet).
- **Startseite für neue Personen**: Reihenfolge und Sichtbarkeit der Startseiten-Karten (Kap. 7).

### 3.2 Einheiten
| Typ | Beschreibung |
|---|---|
| Geschäftsführung | Leitung eines Mandanten oder zentral. |
| Stabsstelle | Immer für alle Mandanten zuständig. |
| Abteilung | Gehört zu einem Mandanten oder ist zentral. |
| Hub | Themengruppe, eigene Regeln (Kap. 8.12). |

- **Titel (Freitext, optional)** für Geschäftsführung und Stabsstelle, z. B. „Intendanz“, „Kaufmännischer Direktor“, „GMD“, „Datenschutzbeauftragte“. Erscheint statt der Typbezeichnung auf der Seite, in Listen und in der Suche. Rechte, Gruppierung und Auswahl hängen weiter am Typ.
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
- **Rollen aus Entra-Gruppen**: Zuordnung Gruppe → Rolle (+ Geltungsbereich), z. B. `IT-GRP-HSO-INTRANET-REDAKTION` → Redaktion · alle Mandanten.
- Microsoft Graph wird mit den nötigsten Berechtigungen genutzt (Profile, Gruppen, Teams-Nachrichten).

### 4.2 Lokale Konten
Für Personen ohne Microsoft-Konto. Angelegt durch die Verwaltung per Einladung.
- **Zweiter Faktor Pflicht**: Authenticator-App (TOTP) oder Passkey.
- **Wiederherstellungscodes**: Einmalcodes (**Vorschlag**: 10), im Konto neu erzeugbar.
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
Im Konto sichtbar und einzeln beendbar.

---

## 5. Rollen und Rechte

### 5.1 Rollen
| Rolle | Geltungsbereich | Darf |
|---|---|---|
| Redaktion | Mandant oder alle | Sieht geplante Beiträge aller Absender, darf an mehrere Mandanten pushen, mehr anheften; pflegt Einheiten ohne eigene Pflege; Bereich „Redaktion“ (Kap. 10). |
| Abteilungsverwaltung | je Abteilung | Pflegt Seite, Team, Zuständigkeiten; vergibt Schreibrechte; schaltet „Hinter den Kulissen“ für die Abteilung frei. |
| Hub-Team | je Hub | Pflegt den Hub gemeinsam; Koordination durch eine Person möglich; vergibt Schreibrechte; kann den Hub ruhen lassen. |
| Organigramm pflegen | alle Mandanten | Lädt neue Fassungen des Organigramms hoch. |
| Vereinbarungen pflegen | je Mandant | Stellt Betriebs- und Dienstvereinbarungen ein. Auch an Personen außerhalb von Betriebsrat/Personalrat vergebbar. |
| Fachpflege | je KBB | Lädt Pläne des KBB hoch und löscht sie. |
| Moderation Schwarzes Brett | je Mandant | Prüft neue und gemeldete Anzeigen, stellt Rückfragen. |
| Mandanten-Admin | je Mandant | Verwaltet den eigenen Mandanten: Branding, Benutzer, Standorte. |
| System-Admin | alle | Verwaltet alles, auch Anmeldung, Regeln und System. Sparsam vergeben. |
| Betreiber | je Standort | Externe; Speiseplan und Standort-Infos. |

Eine eigene Rolle „Autor“ gibt es nicht. Schreibrechte werden je Person delegiert (5.2).

### 5.2 Delegierte Schreibrechte
- Abteilungsverwaltung bzw. Hub-Team vergibt je Person einzeln: **Neuigkeiten**, **FAQs**, **Termine**, **Hinter den Kulissen** (Hubs: Neuigkeiten, FAQs, Termine).
- Höchstens **10 Personen** mit mindestens einem Schreibrecht je Einheit (einstellbar). Abteilungsverwaltung und Hub-Team zählen nicht mit.
- Als Absender erscheint immer die Einheit, nie die Person.

### 5.3 Sichtbarkeit
Siehe Grundprinzip 1. Alle Rechte werden serverseitig geprüft, Mandantengrenzen inklusive.

---

## 6. Navigation und Seitenaufbau

### 6.1 Bereiche
| Bereich | Unterseiten (Reihenfolge) |
|---|---|
| Start | Startseite |
| Aktuelles | Neuigkeiten, Pläne (KBB), Kalender, Aus den Hubs, Hinter den Kulissen, Schwarzes Brett, Speiseplan |
| Organisation | Abteilungen, Hubs, Personen, Organigramm |
| Wissen | FAQs, Rechtliches, Handbuch |

### 6.2 Darstellung je Gerät
- **PC (ab 1024 px)**: Seitenleiste mit Bereichen und Unterseiten.
- **Tablet**: Leiste links mit Bereichen; Unterseiten als Reiter oben. Was nicht in die Zeile passt, steht unter „Mehr ▾“; die aktuelle Seite ist immer als Reiter sichtbar.
- **Handy**: Leiste unten; ein Bereich öffnet zuerst eine Übersicht. Oben ein Knopf „Bereich · Unterseite – Wechseln“, der die Liste der Unterseiten von unten öffnet. Zurück-Pfeil oben links.

### 6.3 Kopfzeile
Suche, Hell/Dunkel, Rückmeldung (Sprechblase), **Nachrichten** (Fach mit Zähler), **Glocke** (Zähler), Konto-Menü.

### 6.4 Konto-Menü
Konto, Redaktion (nur mit Rolle), Verwaltung (nur Admins), Handbuch, Führung erneut starten, Abmelden.

---

## 7. Startseite
1. Begrüßung mit Mandant und Datum; Knopf **„Startseite anpassen“**.
2. **Dringende Meldungen** als rotes Banner (Kap. 8.2).
3. **Favoriten**: Kacheln, höchstens 8. Hinzufügen per Stern ☆ auf der jeweiligen Seite. Standard: Rechtliches, IT, FAQs, Pläne.
4. **Karten**: Neuigkeiten, Heute und morgen, Neu in Ihren Hubs, Speiseplan, Neueste Pläne (KBB).

**Startseite anpassen**: Karten ein-/ausblenden und mit ↑ ↓ sortieren; im selben Modus Favoriten mit ← → sortieren und mit × entfernen. „Auf Standard zurücksetzen“ führt zum Standard des Mandanten (Verwaltung → Mandanten). Die Einstellung gilt für das Konto, also auf allen Geräten. Dringende Meldungen und Favoriten stehen immer oben.

---

## 8. Inhalte

### 8.1 Neuigkeiten
- **Absender**: Geschäftsführung, Stabsstellen, Abteilungen. Hub-Beiträge stehen getrennt (8.3).
- **Freigabe** (geplant veröffentlichen) und **Ablaufdatum**. Geplante Beiträge sehen die Schreibenden der Einheit und die Redaktion (Filter „Geplant“).
- **Zielgruppe („Wer sieht das?“)**: Nicht-zentrale Einheiten veröffentlichen nur für den eigenen Mandanten; zentrale Absender wählen alle oder einzelne Mandanten. Standortbezogene Beiträge sehen nur Personen mit diesem Standort.
- Veröffentlichung **ohne Redaktionsfreigabe**.
- **WYSIWYG-Editor**, **Dateianhänge** (verschlüsselt).
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
Je Einheit; Schreibrecht „FAQs“. Frage, Antwort im Editor mit Links und Anhängen.

### 8.10 Rechtliches
- Gesetze und Tarifverträge (einfache Liste) sowie **Betriebs- und Dienstvereinbarungen**.
- Vereinbarungen gelten **je Mandant**, mit Stand, „gilt ab“ und mehreren sortierbaren Anhängen. Keine Entwürfe, keine früheren Fassungen, keine Themen, keine Nummern. Eine neue Fassung ersetzt die alte vollständig.
- Pflege durch die Rolle „Vereinbarungen pflegen“.

### 8.11 Abteilungsseiten
- Kopf: Name, Typ bzw. Titel, Zuständigkeit (Mandant/alle), Leitung (+ zweite Leitung) und Stellvertretung, Stern für Favoriten.
- Hauptspalte: **Wer hilft bei was?**, **Team**, **Über uns**. Seitenspalte: Nächste Termine, Beiträge, FAQs.
- **Zuständigkeiten**: Suche, Stichwörter, Gruppen, Links; ist eine Person inaktiv, wird die Vertretung angezeigt. Prüf-Erinnerung nach 12 Monaten (einstellbar), Bestätigung mit „Alles geprüft“. Bearbeiten als Akkordeon.
- Leere Felder werden nicht angezeigt.

### 8.12 Hubs
- **Hub beantragen**: Name, Beschreibung, Begründung, Hub-Team, Zuständigkeit. Die Redaktion prüft vor (Rückfrage oder „An Verwaltung geben“); die Verwaltung legt an oder lehnt mit Begründung ab, jederzeit auch ohne Vorprüfung. Rückfragen laufen über Nachrichten; ohne Antwort wird der Antrag nach **30 Tagen** geschlossen (einstellbar).
- **Aufbau der Seite** einstellbar: Abschnitte ein-/ausblenden und sortieren (Hauptbereich und Seitenleiste).
- Hinweis oben, Termine, Ansprechpersonen.
- **Ruhen** (Hub-Team) und **Archivieren** (nur Verwaltung).
- Benachrichtigungen je Hub einstellbar (Kap. 11).

### 8.13 Personen und Kontaktdaten
- Jede Person pflegt selbst: Position, Telefon, Mobil, Raum, Standort (keine Übernahme aus Entra).
- **Mobil**: Sichtbarkeit wählbar – Alle / Nur mein Team (Standard) / Niemand.
- Profilfoto freiwillig, unabhängig von Entra, verschlüsselt gespeichert.

### 8.14 Suche
Globale Suche über Personen, Einheiten, Beiträge, FAQs, Vereinbarungen und Seiten; Ergebnisse nur im Rahmen der Rechte und Mandantengrenzen.

---

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
- **Teams** über die Intranet-App im Tenant; Nachrichten enthalten nur Titel, Absender und Link.

### 11.2 Voreinstellungen je Thema
| Thema | Glocke | Push | E-Mail | Teams |
|---|---|---|---|---|
| Dringende Meldungen | an (fest) | an (fest) | an | an |
| Angeheftete Beiträge | an | an | aus | aus |
| Neuigkeiten | an | aus | an | – |
| Hinter den Kulissen | an | aus | aus | – |
| Speiseplan (eigener Standort) | aus | aus | aus | – |
| Pläne (KBB) | an | aus | an | – |
| Schwarzes Brett | aus | aus | aus | – |
| Nachrichten | an | an | an | – |
| Hubs | je Hub in „Meine Hubs“ | | | |

Teams ist nur für dringende und angeheftete Beiträge verfügbar.

### 11.3 Weitere Einstellungen
- **E-Mail-Zusammenfassung** (Standard täglich): enthält alle Themen mit E-Mail.
- **Ruhezeiten** (Standard an): keine Push- und Teams-Nachrichten, danach gesammelt zugestellt; Glocke und E-Mail nicht betroffen. Ausnahme dringende Meldungen (8.2).

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
- **Rückmeldung** (Sprechblase): Fehler oder Idee, mit Angabe der Seite; Stand unter „Meine Meldungen“, Antworten und Rückfragen über Nachrichten. Nach dem Senden zurück zur Ausgangsseite.
- Bewegungen respektieren „Bewegung reduzieren“ des Systems.

---

## 14. Verwaltung
Nur Mandanten-Admins (eigener Mandant) und System-Admins.

| Bereich | Inhalt |
|---|---|
| Mandanten | Name, Kürzel, Admins, Domains, Branding, Leitung, KBB, Interessenvertretung, Startseite für neue Personen |
| Abteilungen und Hubs | Liste mit Filtern (u. a. „Nur ohne Pflege“), Anlegen/Bearbeiten: Typ, Titel, Name, Zuständigkeit, Ausblenden, Pflege, Rechte (Dringend, Termine), Pflicht-Abo |
| Standorte | Standorte, Betreiber-Konten |
| Benutzer und Rollen | Benutzerliste, lokale Konten anlegen/deaktivieren, Rollen mit Geltungsbereich, Rollen aus Entra-Gruppen |
| Anmeldung | Entra-Verbindung, Zugangsgruppe, Abgleich, Graph-Berechtigungen; Passwortrichtlinie (4.2) |
| Regeln für Inhalte | Anheften, Dringende Meldungen, Schreibrechte, Kalender, Zuständigkeiten, Hinter den Kulissen, Schwarzes Brett, Hub-Anträge, Reaktionen |
| Benachrichtigungen | Web Push, E-Mail (Absender), Teams; Status und Testnachricht |
| Rückmeldungen | Eingegangene Fehler und Ideen bearbeiten, beantworten |
| Löschfristen | Kap. 15 |
| Protokoll | Änderungen in der Verwaltung |
| System | Version, Zustand, Sicherungen |

Jede Änderung in der Verwaltung wird protokolliert (wer, was, wann; ohne Inhalte von Beiträgen).

---

## 15. Datenschutz und Löschfristen
Standardwerte, in der Verwaltung einstellbar, sofern Optionen angegeben.

| Daten | Frist (Standard) | Optionen |
|---|---|---|
| Anzeigen am Schwarzen Brett | 30 Tage nach Ablauf/Erledigt/Ablehnung | sofort, 14, 30, 90 Tage |
| Vergangene Termine (Abteilungen/Hubs) | 3 Monate | 1 Monat, 3 Monate, 1 Jahr |
| Archivierte Hubs | 2 Jahre | 1, 2, 3 Jahre |
| Geschlossene Gespräche | 90 Tage | 30, 90 Tage, 1 Jahr |
| Abgelehnte Hub-Anträge | 90 Tage | 30, 90 Tage, 1 Jahr |
| Vergessene Pläne des KBB | 3 Monate nach „Gültig bis“ | 1, 3, 6 Monate, 1 Jahr |
| Speisepläne | am Tag nach „Gültig bis“ | – |
| Vereinbarungen | beim Ersetzen | – |
| Dateien gelöschter Inhalte | sofort (Schlüssel wird vernichtet) | – |
| Deaktivierte Konten | 90 Tage | 30, 90, 180 Tage |
| Profilfotos | sofort bei Deaktivierung oder auf Wunsch | – |
| Reaktionen | mit Beitrag bzw. Konto | – |
| Benachrichtigungen (Glocke) | 90 Tage | 30, 90, 180 Tage |
| Protokoll der Verwaltung | 1 Jahr | 6 Monate, 1, 2, 3 Jahre |
| Anmeldeprotokoll (gekürzte IP) | 30 Tage | 7, 30, 90 Tage |
| Sitzungen | sofort nach Ende | – |
| Kalender-Abo-Links | nach 12 Monaten ohne Abruf | – |
| Technische Fehlerprotokolle | ohne Namen und Inhalte | einstellbar |
| Rückmeldungen | nach Abschluss | einstellbar |

Weitere Regeln:
- Beiträge gehören der Einheit und bleiben beim Deaktivieren eines Kontos erhalten.
- Reaktionen: nur „hat reagiert“ wird gespeichert, angezeigt nur die Anzahl – auch der Verwaltung.
- Offline zwischengespeicherte Dateien liegen auf dem Gerät und werden beim Abmelden gelöscht (**Vorschlag**).
- Für den Betriebsrat wird eine Unterlage zum Intranet erstellt (Daten, Auswertbarkeit, Protokolle).

---

## 16. Sicherheit (OWASP ASVS Level 2)
- **Authentisierung** nach Kap. 4; Passwörter mit Argon2id gehasht (**Vorschlag**).
- **Sitzungen**: sichere, HttpOnly-, SameSite-Cookies; Abmelden nach Inaktivität; Sitzungen beendbar.
- **Zugriffskontrolle** serverseitig für jede Anfrage: Rolle, Geltungsbereich und Mandant. Mandantentrennung zusätzlich auf Datenbankebene absichern (**Vorschlag**: Row-Level Security in PostgreSQL).
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
- PDFs: Hinweis, dass die Barrierefreiheit von der Quelle abhängt.

---

## 18. Betrieb
- Docker Compose: Anwendung, PostgreSQL; Dateien in einem verschlüsselten Volume bzw. verschlüsselt im Dateisystem.
- Erreichbar über den NetBird Reverse Proxy; Bereitstellung per Arcane Git-Sync aus dem Repo.
- Konfiguration über Umgebungsvariablen bzw. Secrets (keine Secrets im Repo).
- Sicherung von Datenbank und Dateien (**Vorschlag**: täglich, Aufbewahrung 30 Tage, regelmäßiger Wiederherstellungstest).
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
- Start-Favoriten pro Mandant
- Organigramm als eigene Darstellung im Intranet, Strukturpflege („Gehört zu“, „Nur im Organigramm“, Beziehungen) und Rolle „Organisation pflegen“
- Notfall-Upload des Speiseplans durch die Verwaltung
- Gemeinsame Einheit „Geschäftsführung“ (ersetzt durch Intendanz, kaufmännische Geschäftsführung, GMD)

---

## 20. Vorschlag: Umsetzung in Etappen
1. Anmeldung (Entra, lokal), Mandanten, Rollen, Einheiten, Neuigkeiten, Startseite
2. Benachrichtigungen, FAQs, Kalender, Pläne (KBB), Speiseplan
3. Hubs, Hinter den Kulissen, Schwarzes Brett, Nachrichten, Redaktion
4. Führung, Einführungen, Handbuch, Feinschliff, Sicherheitsprüfung
