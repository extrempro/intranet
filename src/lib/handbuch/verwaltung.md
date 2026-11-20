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

## System

Unter **System** siehst du die Version, den Zustand von Datenbank, Dateien, Hintergrundaufgaben und Entra-Abgleich, die Anbindungen (Entra, E-Mail, Web Push) und die **Sicherungen**:

- wann zuletzt gesichert wurde und ob es geklappt hat,
- das Ergebnis des wöchentlichen **Wiederherstellungstests**,
- die vorhandenen Sicherungen und den freien Speicher.

Schlägt eine Sicherung fehl oder ist die letzte erfolgreiche älter als 26 Stunden, bekommen alle System-Admins eine Benachrichtigung (Thema „Betrieb und Sicherungen“, höchstens einmal am Tag je Meldung).

### Wiederherstellen

Wiederherstellen geht nur auf dem Server, nicht im Intranet. Die Anleitung steht im Repo unter `backup/README.md`. Du brauchst dafür den privaten Schlüssel der Sicherung und den `ENCRYPTION_KEY`; beide liegen nicht auf dem Server.
