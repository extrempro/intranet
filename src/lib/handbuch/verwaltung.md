---
titel: Verwaltung im Überblick
kapitel: verwaltung
rollen: verwaltung
reihenfolge: 1
kurz: Mandanten, Abteilungen, Benutzer und Rollen.
---

Die Verwaltung erreichst du über das Konto-Menü. Mandanten-Admins verwalten ihren Mandanten, System-Admins alles. Jede Änderung wird protokolliert.

- **Mandanten**: Angaben und Farben, E-Mail-Domains, Mandanten-Admins, Startseite für neue Personen (Karten und Standard-Favoriten).
- **Abteilungen und Hubs**: anlegen, Typ, Zuständigkeit, Ausblenden, Rechte (Dringend, Termine), Pflicht-Abo, Team und Pflege-Rolle.
- **Standorte**: Kantinen und Betreiber-Konten.
- **Benutzer und Rollen**: Rollen mit Geltungsbereich vergeben, Konten sperren; lokale Konten einladen.
- **Nur System-Admins**: Anmeldung, Rollen aus Entra-Gruppen, Kategorien des Schwarzen Bretts, Hinweis „Hinter den Kulissen“ und **System**.

Gesperrte Konten werden nach der Löschfrist (Standard 90 Tage) gelöscht; Inhalte der Einheiten bleiben.

## Erneute Anmeldung

Bei besonders wichtigen Änderungen fragt das Intranet noch einmal nach, ob wirklich du es bist: beim Vergeben und Entziehen von Rollen (auch Mandanten-Admins und Rollen aus Entra-Gruppen), beim Sperren und Freigeben von Konten, bei den Einstellungen unter **Anmeldung** und beim **SMTP-Server**. So kann niemand eine offen gelassene Sitzung dafür nutzen.

- Mit **Microsoft-Konto** meldest du dich in einem kleinen Fenster noch einmal bei Microsoft an.
- Mit **lokalem Konto** bestätigst du mit dem Code aus deiner Authenticator-App, einem Wiederherstellungscode oder deinem Passkey.

Danach geht deine Änderung automatisch weiter, und du kannst 10 Minuten lang ohne erneute Nachfrage ändern. In der **Teams-App** geht das nicht; öffne die Verwaltung dafür im Browser.

## Anmeldung

Unter **Anmeldung** pflegst du als System-Admin:

- **Microsoft Entra ID**: Tenant-ID, Client-ID und Zugangsgruppe. Leere Felder nehmen den Wert aus der `.env`; das Client-Secret steht nur dort. **Verbindung prüfen** zeigt, ob Microsoft erreichbar ist, ob Client-ID und Secret gelten, welche Anwendungsberechtigungen erteilt sind und ob es die Zugangsgruppe gibt.
- **Lokale Konten**: Mindestlänge neuer Passwörter (12, 14 oder 16 Zeichen) und wie lange der Link „Passwort vergessen“ gilt (15, 30 oder 60 Minuten). Bestehende Passwörter bleiben gültig.
- **Abmelden nach Inaktivität**.

### Abgleich mit Entra

Jede Nacht (Standard 02:30 Uhr) gleicht das Intranet Name, E-Mail, Mandant und Rollen aller Microsoft-Konten mit Entra ab:

- In Entra **gelöschte oder deaktivierte** Konten und Personen **ohne Zugangsgruppe** werden gesperrt, ihre Sitzungen beendet.
- Werden sie in Entra wieder gültig, gibt der Abgleich sie wieder frei. Konten, die die Verwaltung gesperrt hat, bleiben gesperrt.
- Würde der Abgleich mehr als 10 % der Konten sperren, hält er an. Prüfe dann Zugangsgruppe und Domains; stimmt alles, startest du ihn unter Anmeldung mit „Trotzdem abgleichen“.

Gesperrte Konten stehen im Protokoll mit Grund. Schlägt der Abgleich fehl, bekommen die System-Admins eine Benachrichtigung.

## E-Mail

Unter **Benachrichtigungen** pflegst du als System-Admin den **SMTP-Server** für alle E-Mails des Intranets (Einladungen, „Passwort vergessen“, Benachrichtigungen):

- Server, Port und Verschlüsselung: **STARTTLS** (meist 587), **TLS** (meist 465) oder **ohne** für einen internen Relay (meist 25).
- Benutzer und Passwort, wenn der Server eine Anmeldung verlangt. Das Passwort wird verschlüsselt gespeichert und nie wieder angezeigt; leer lassen behält es.
- Absenderadresse, Anzeigename und optional „Antworten an“.

Leere Felder nehmen den Wert aus der `.env`. **Test-E-Mail an mich** zeigt sofort, ob alles passt, und bei einem Fehler, woran es liegt. Mandanten-Admins sehen nur, ob der Versand eingerichtet ist.

## Teams

Das Intranet läuft auch als App in Teams. Ebenfalls unter **Benachrichtigungen** schaltest du die Teams-Meldungen ein. Einmalig nötig:

1. In der App-Registrierung die Anwendungsberechtigung **TeamsActivity.Send** hinzufügen und die Administratorzustimmung erteilen.
2. Unter **Expose an API** die Application ID URI setzen (der genaue Wert steht in der Verwaltung), den Scope **access_as_user** anlegen und die beiden Teams-Clients vorab berechtigen.
3. Für die delegierten Rechte **User.Read** und **GroupMember.Read.All** die Administratorzustimmung erteilen.
4. Das **App-Paket** herunterladen und im Teams Admin Center unter „Apps verwalten“ hochladen.
5. Die App per **Setup-Richtlinie** für alle oder die Intranet-Gruppe installieren.

Unter **Aussehen der Teams-App** legst du Name, Beschreibung, Herausgeber, Akzentfarbe und Symbol fest. Ohne eigene Angaben nimmt die App das App-Symbol und die Farbe des Hauptmandanten. Nach jeder Änderung entsteht eine neue Version des Pakets: herunterladen und die App im Teams Admin Center aktualisieren.

In Teams melden sich die Leute automatisch mit ihrem Microsoft-Konto an. Meldungen kommen nur bei Personen mit Microsoft-Konto an, bei denen die App installiert ist. **Testmeldung an mich** zeigt, ob alles passt. Ändert sich die Adresse des Intranets oder die App-Registrierung, erzeuge eine neue Version des Pakets und aktualisiere die App.

## System

Ganz oben zeigt **Startklar**, ob alles für den Betrieb eingerichtet ist: Adresse, Adressen hinter dem Reverse Proxy, Anmeldung mit Microsoft, Notfallzugang (lokales Konto mit Rolle System-Admin), E-Mail, Sicherung, Push, Datenschutz und Impressum, Teams-App und Datenbank. Grün ist erledigt, Gelb ein Hinweis, Rot muss behoben werden. „Einstellen“ führt zur passenden Seite. Die ganze Anleitung für den Start steht im Repo unter `docs/inbetriebnahme.md`.

Unter **System** siehst du die Version, den Zustand von Datenbank, Dateien, Hintergrundaufgaben und Entra-Abgleich, die Anbindungen (Entra, E-Mail, Web Push) und die **Sicherungen**:

- wann zuletzt gesichert wurde und ob es geklappt hat,
- das Ergebnis des wöchentlichen **Wiederherstellungstests**,
- die vorhandenen Sicherungen und den freien Speicher.

Schlägt eine Sicherung fehl oder ist die letzte erfolgreiche älter als 26 Stunden, bekommen alle System-Admins eine Benachrichtigung (Thema „Betrieb und Sicherungen“, höchstens einmal am Tag je Meldung).

### Wiederherstellen

Wiederherstellen geht nur auf dem Server, nicht im Intranet. Die Anleitung steht im Repo unter `backup/README.md`. Du brauchst dafür den privaten Schlüssel der Sicherung und den `ENCRYPTION_KEY`; beide liegen nicht auf dem Server.
