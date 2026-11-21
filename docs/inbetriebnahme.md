# Inbetriebnahme

Schritt für Schritt vom leeren Server zum laufenden Intranet, danach Updates und Störungen. Was eingerichtet ist, zeigt **Verwaltung → System → Startklar**. Vor dem Start sollte dort nichts mehr rot sein.

Für den Betrieb wird nichts im Repo geändert: Alle Werte stehen in den Umgebungsvariablen des Compose-Projekts, die Images kommen fertig aus der GitHub Container Registry.

## 1. Voraussetzungen

- **Docker-Host mit Docker-Verwaltung**, Docker Compose v2. Etwa 2 CPU, 4 GB RAM, Platz für Datenbank, Dateien und Sicherungen (Sicherungen am besten auf einem eigenen Datenträger, siehe [backup/README.md](../backup/README.md)).
- **Reverse Proxy** mit eigener Adresse, z. B. `intranet.example.org`, und gültigem Zertifikat.
- **Microsoft Entra ID**: Recht, eine App-Registrierung anzulegen und Administratorzustimmung zu erteilen; zwei Gruppen (Zugang, System-Admins).
- **SMTP-Server** oder interner Relay.
- **Ausgehende Verbindungen** vom Docker-Host:

| Ziel                                                                                            | Wofür                                   |
| ----------------------------------------------------------------------------------------------- | --------------------------------------- |
| `ghcr.io`                                                                                       | Images laden                            |
| `login.microsoftonline.com`, `graph.microsoft.com`                                              | Anmeldung, Abgleich, Teams-Meldungen    |
| `api.pwnedpasswords.com`                                                                        | Prüfung neuer Passwörter lokaler Konten |
| `fcm.googleapis.com`, `*.push.services.mozilla.com`, `*.push.apple.com`, `*.notify.windows.com` | Web Push                                |
| SMTP-Server                                                                                     | E-Mails                                 |

## 2. Schlüssel und Passwörter erzeugen

Auf einem Arbeitsplatz, nicht auf dem Server. Alles kommt in den Passwortmanager (Sammlung der IT-Abteilung), **bevor** das Intranet startet.

```bash
openssl rand -base64 32        # ENCRYPTION_KEY
openssl rand -base64 24        # POSTGRES_PASSWORD
openssl rand -base64 24        # APP_DATABASE_PASSWORD (anderer Wert!)
age-keygen -o intranet-sicherung.key   # Schlüssel für die Sicherungen
```

- **`ENCRYPTION_KEY`** schützt Dateien, TOTP-Schlüssel, SMTP-Passwort und Push-Schlüssel. Geht er verloren, sind Dateien und Sicherungen wertlos. Nie ändern.
- Von `intranet-sicherung.key` kommt nur der **öffentliche** Schlüssel (`age1…`) in `BACKUP_AGE_RECIPIENTS`. Den privaten Schlüssel nur im Passwortmanager ablegen, danach die Datei löschen.

## 3. Microsoft Entra

Unter **App-Registrierungen → Neue Registrierung**, „Nur Konten in diesem Organisationsverzeichnis“.

1. **Authentifizierung**: Plattform „Web“, Umleitungs-URI `https://<Adresse>/anmelden/entra/callback`.
2. **Zertifikate & Geheimnisse**: Clientgeheimnis anlegen → `ENTRA_CLIENT_SECRET`. Ablaufdatum im Kalender eintragen; vor Ablauf ein neues anlegen und in Docker-Verwaltung tauschen.
3. **API-Berechtigungen** (Microsoft Graph), danach **Administratorzustimmung erteilen**:
   - Delegiert: `openid`, `profile`, `email`, `User.Read`, `GroupMember.Read.All`
   - Anwendung: `User.Read.All`, `GroupMember.Read.All` (nächtlicher Abgleich), `TeamsActivity.Send` (Teams-Meldungen)
4. **API verfügbar machen** (für die Teams-App):
   - Anwendungs-ID-URI: `api://<Adresse ohne https://>/<Client-ID>`
   - Bereich `access_as_user` (Administratoren und Benutzer)
   - Autorisierte Clientanwendungen: `1fec8e78-bce4-4aaf-ab1b-5451cc387264` (Teams Desktop und Mobil) und `5e3ce6c0-2b1f-4285-8d4b-75ee78787346` (Teams im Browser). Soll die App auch in Outlook und Microsoft 365 laufen, zusätzlich deren Client-IDs (Liste in `src/lib/server/teams-sso.ts`).
5. **Zugangsgruppe**: Object-ID der Gruppe, deren Mitglieder sich mit Microsoft anmelden dürfen → `ENTRA_ACCESS_GROUP_ID`. System-Admins vergibt das Intranet selbst (siehe 6.); weitere Rollen lassen sich unter „Rollen aus Entra-Gruppen“ an Gruppen hängen.
6. **Bedingter Zugriff**: Prüfen, dass die App-Registrierung in den Richtlinien enthalten ist (MFA, ggf. konforme Geräte). Das gilt auch für die Anmeldung in der Teams-App und für die erneute Anmeldung vor kritischen Verwaltungsaktionen.

Tenant-ID und Client-ID stehen auf der Übersichtsseite der Registrierung.

## 4. Compose-Projekt

1. Projekt aus dem Git-Repository anlegen (Git-Sync), Zweig `main`, Compose-Datei `docker-compose.yml`.
2. **Umgebungsvariablen** im Projekt hinterlegen. Vorlage mit Erklärungen: [.env.example](../.env.example). Mindestens:

| Variable                                                                | Wert                                                                                      |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `INTRANET_VERSION`                                                      | Version aus den [Releases](https://github.com/extrempro/intranet/releases), z. B. `0.7.0` |
| `ORIGIN`                                                                | `https://<Adresse>`, genau wie im Browser                                                 |
| `APP_PORT`, `APP_BIND`                                                  | Port und interne Adresse des Docker-Hosts (nur der Proxy erreicht die Anwendung)               |
| `ADDRESS_HEADER`, `XFF_DEPTH`                                           | `X-Forwarded-For` und `1` (siehe 5.)                                                      |
| `POSTGRES_USER`, `POSTGRES_DB`                                          | `intranet`                                                                                |
| `POSTGRES_PASSWORD`, `APP_DATABASE_PASSWORD`                            | aus 2.                                                                                    |
| `ENCRYPTION_KEY`                                                        | aus 2.                                                                                    |
| `BACKUP_AGE_RECIPIENTS`                                                 | öffentlicher age-Schlüssel aus 2.                                                         |
| `ENTRA_TENANT_ID`, `ENTRA_CLIENT_ID`, `ENTRA_CLIENT_SECRET`             | aus 3.                                                                                    |
| `TEAMS_APP_ID`                                                          | erst nach dem Verteilen der Teams-App (siehe 7.)                                          |
| `ENTRA_ACCESS_GROUP_ID`                                                 | aus 3.                                                                                    |
| `SMTP_HOST`, `SMTP_SECURITY`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM` | SMTP (auch später in der Verwaltung pflegbar)                                             |
| `PUSH_CONTACT`                                                          | `mailto:it@example.org`                                                         |

3. **Images**: Das Paket `ghcr.io/extrempro/intranet` (und `intranet-backup`) muss öffentlich sein (GitHub → Packages → Package settings → Change visibility). Sonst auf dem Host `docker login ghcr.io` mit einem Token mit `read:packages`.

## 5. Reverse Proxy

- Ziel: `http://<interne Adresse des Docker-Hosts>:<APP_PORT>`, öffentlich nur per HTTPS.
- Header **`X-Forwarded-For`** an die Anwendung weitergeben. Mit `ADDRESS_HEADER=X-Forwarded-For` und `XFF_DEPTH=1` sieht das Intranet dann die echte Adresse (Begrenzungen je IP, Anmeldeprotokoll). Reihenfolge: zuerst im Proxy aktivieren, dann die Variable setzen; fehlt der Header, antwortet die Anwendung mit einem Fehler.
- Anfragen bis **21 MB** zulassen (Hochladen von Dateien), Zeitlimit mindestens 60 Sekunden.
- Nichts zwischenspeichern; die Anwendung setzt eigene `Cache-Control`-Header.

## 6. Erster Start

1. In Docker-Verwaltung das Projekt starten. Die Anwendung spielt die Migrationen ein.
2. `https://<Adresse>/health` muss `ok` zeigen.
3. **Einrichtungslink** aus dem Log holen (`docker compose logs app` bzw. Logs in Docker-Verwaltung):
   `https://<Adresse>/einrichtung/…`. Er gilt 24 Stunden und nur einmal; ein Neustart der Anwendung erzeugt einen neuen, solange die Einrichtung nicht abgeschlossen ist. Den Link sieht nur, wer die Logs lesen darf.
4. Im Browser öffnen und einrichten:
   - **Hauptmandant**: Name, Kürzel, E-Mail-Domains, Akzentfarben
   - **Erster Admin** als lokales Konto: Name und E-Mail-Adresse mit einer der Domains, dann Passwort, zweiter Faktor (App oder Passkey) und Wiederherstellungscodes. Zugang und Codes in den Passwortmanager: Das ist auch der **Notfallzugang**, wenn die Anmeldung mit Microsoft nicht geht.
5. **Verwaltung → System → Startklar** öffnen und von oben nach unten abarbeiten:
   - **Adressen hinter dem Reverse Proxy**: „erkannt“ muss die öffentliche Adresse deines Geräts sein, nicht die des Proxys.
   - **Anmeldung**: Entra-Werte prüfen, „Verbindung prüfen“, dann „Jetzt abgleichen“. Danach mit deinem Microsoft-Konto anmelden und dir unter Benutzer und Rollen (oder über „Rollen aus Entra-Gruppen“) die Rolle System-Admin geben.
   - **E-Mail**: unter Benachrichtigungen „Test-E-Mail an mich“.
   - **Datenschutz und Impressum**: beim Hauptmandanten die Links eintragen, dazu Farben, Symbol und weitere Domains.
   - **Sicherung**: Beim ersten Start sichert der Dienst sofort und testet die Wiederherstellung. Nach ein paar Minuten muss der Punkt grün sein.
6. Weitere Mandanten, Abteilungen, Hubs und Standorte anlegen (Handbuch „Verwaltung im Überblick“).

## 7. Teams-App

1. Verwaltung → Benachrichtigungen → Teams: **Aussehen** festlegen, Teams-Meldungen einschalten, **App-Paket** herunterladen.
2. Im **Teams Admin Center** unter „Apps verwalten“ hochladen und per **Setup-Richtlinie** für die Intranet-Gruppe installieren.
3. Die **App-ID** (steht unter „Aussehen der Teams-App“) als `TEAMS_APP_ID` in die `.env` eintragen. So bleibt sie auch nach einer Neuinstallation mit neuer Datenbank gleich (eine Wiederherstellung aus der Sicherung behält sie ohnehin); sonst meldet Teams „App nicht gefunden“ und die App muss neu verteilt werden. Nach einer neuen Datenbank beginnt die Paketversion wieder bei 1.0.1: vor dem Aktualisieren im Teams Admin Center so oft „Neue Version erzeugen“, bis sie über der hochgeladenen liegt.
4. „Testmeldung an mich“ senden und in Teams auf Desktop, im Browser, auf iPhone und Android prüfen: Die Meldung erscheint unter „Aktivität“, ein Klick öffnet das Intranet.

## 8. Vor dem Start

- [ ] Startklar ohne Fehler und Hinweise
- [ ] Wiederherstellen einmal geprobt ([backup/README.md](../backup/README.md)), privater age-Schlüssel und `ENCRYPTION_KEY` im Passwortmanager
- [ ] Lokalen Admin ausprobiert (lokal anmelden, Verwaltung öffnen), Zugang und Wiederherstellungscodes im Passwortmanager
- [ ] Clientgeheimnis-Ablauf im Kalender
- [ ] Unterlage für den Betriebsrat abgestimmt
- [ ] Externer Penetrationstest ([docs/sicherheit.md](sicherheit.md), offene Punkte)
- [ ] Inhalte: Startseite, erste Neuigkeiten, Rechtliches, FAQs

## 9. Updates

1. In den [Releases](https://github.com/extrempro/intranet/releases) nachsehen, was sich geändert hat.
2. Vor größeren Updates von Hand sichern: `docker compose exec backup sicherung.sh`.
3. In Docker-Verwaltung `INTRANET_VERSION` auf die neue Version setzen und das Projekt neu bereitstellen (Images neu laden). Die Anwendung spielt neue Migrationen beim Start selbst ein.
4. Verwaltung → System: Version, Migrationen und Startklar prüfen.

Zurück auf die vorige Version geht nur, wenn das Update keine Migration enthielt. Sonst die Sicherung von vor dem Update wiederherstellen.

## 10. Störungen

- **Logs**: `docker compose logs app` (bzw. in Docker-Verwaltung). Docker behält je Container 3 × 10 MB.
- **Anmeldung mit Microsoft geht nicht**: mit dem lokalen Admin anmelden, unter Anmeldung „Verbindung prüfen“. Häufig: Clientgeheimnis abgelaufen, Administratorzustimmung fehlt, `ORIGIN` passt nicht zur Umleitungs-URI.
- **Alle Anfragen mit Fehler 400/500 nach einer Änderung am Proxy**: `ADDRESS_HEADER` gesetzt, aber der Proxy schickt den Header nicht.
- **Sicherung rot**: Verwaltung → System zeigt den Grund; System-Admins bekommen zusätzlich eine Benachrichtigung.
- **Kein lokaler Admin erreichbar** (Zugang verloren, nach einer Wiederherstellung): `docker compose exec app node scripts/notfall-admin.mjs` erzeugt einen Link für einen weiteren lokalen System-Admin (24 Stunden, einmalig, im Protokoll). Nimm eine eigene E-Mail-Adresse, z. B. `it-notfall@…`.
- **Daten wiederherstellen**: [backup/README.md](../backup/README.md).
