# Intranet

Mandantenfähiges Intranet als Progressive Web App: Neuigkeiten, Abteilungen und Hubs, Kalender,
Pläne, Speiseplan, Schwarzes Brett, Nachrichten und eine Verwaltung.

Was das Intranet können soll, steht in der **[Spezifikation](docs/spec.md)**.

## Stack

- [SvelteKit](https://svelte.dev/docs/kit) mit TypeScript
- PostgreSQL mit [Drizzle ORM](https://orm.drizzle.team)
- Betrieb in Docker hinter dem NetBird Reverse Proxy, Bereitstellung per Arcane Git-Sync

## Entwicklung

Voraussetzungen: Node.js 24 oder neuer, eine PostgreSQL-Datenbank (z. B. über `docker compose up db`).

```bash
cp .env.example .env        # Werte anpassen
npm install
npm run db:migrate          # sobald Migrationen vorhanden sind
npm run dev
```

| Befehl                 | Zweck                                             |
| ---------------------- | ------------------------------------------------- |
| `npm run dev`          | Entwicklungsserver                                |
| `npm run check`        | Typen prüfen                                      |
| `npm run lint`         | Lint prüfen                                       |
| `npm run format:check` | Formatierung prüfen (`npm run format` korrigiert) |
| `npm test`             | Tests                                             |
| `npm run build`        | Produktions-Build                                 |
| `npm run db:generate`  | Migration aus dem Schema erzeugen                 |

## Betrieb

Schritt für Schritt vom leeren Server bis zum Start, mit Updates und Störungen:
**[docs/inbetriebnahme.md](docs/inbetriebnahme.md)**. Was eingerichtet ist, prüft
Verwaltung → System → **Startklar**.

Die Images baut GitHub Actions bei jedem Release (`ghcr.io/extrempro/intranet:<Version>` und
`ghcr.io/extrempro/intranet-backup:<Version>`); `INTRANET_VERSION` wählt die Version.

```bash
cp .env.example .env        # INTRANET_VERSION, ORIGIN, Passwörter usw. setzen
docker compose up -d
# selbst bauen statt laden:
docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build
```

Die Anwendung hört im Container auf Port 3000 (`APP_PORT` auf dem Host). Der Zustand ist unter
`/health` abrufbar. Die Datenbank ist nicht nach außen veröffentlicht.

Web Push braucht ausgehend HTTPS zu den Push-Diensten der Browser: `fcm.googleapis.com`,
`*.push.services.mozilla.com`, `*.push.apple.com` und `*.notify.windows.com`. Die VAPID-Schlüssel
erzeugt die Anwendung beim ersten Start selbst und speichert sie verschlüsselt (`ENCRYPTION_KEY`).
Installierbar ist das Intranet nur über HTTPS (über den Reverse Proxy gegeben).

Die Anmeldung mit Microsoft braucht eine App-Registrierung in Entra (Werte in `.env.example`).
Der nächtliche Abgleich (02:30, `ENTRA_SYNC_TIME`) liest mit den **Anwendungsberechtigungen**
`User.Read.All` und `GroupMember.Read.All` Profile und Gruppen aller Microsoft-Konten. Er sperrt
in Entra gelöschte oder deaktivierte Konten und Personen ohne Zugangsgruppe; würde er mehr als
10 % sperren, hält er an. Zustand und „Jetzt abgleichen“: Verwaltung → System.

Das Intranet läuft auch als **App in Teams** (Anmeldung per SSO und On-Behalf-Of, eigenes
partitioniertes Sitzungs-Cookie). Einbetten darf es nur Teams, Outlook und Microsoft 365.
Benachrichtigungen gehen über den Aktivitätsfeed von Microsoft Graph (`TeamsActivity.Send`). Das
App-Paket, sein Aussehen und die Einrichtung in Entra stehen unter Verwaltung → Benachrichtigungen.

E-Mails (Einladungen, „Passwort vergessen“, Benachrichtigungen) gehen per **SMTP** raus
(`SMTP_*` und `MAIL_FROM` in der `.env` oder unter Verwaltung → Benachrichtigungen). Der Server
braucht dafür ausgehend Zugriff auf den SMTP-Server.

Sicherungen macht der Dienst `backup` (täglich, verschlüsselt, mit wöchentlichem
Wiederherstellungstest). Einrichten und Wiederherstellen: [backup/README.md](backup/README.md).
Die CI prüft Sicherung, Wiederherstellungstest und Wiederherstellen bei jedem Lauf mit der echten
`docker-compose.yml` (`backup/ci-test.sh`).

Logs: Docker behält je Container höchstens 3 Dateien à 10 MB (`x-logging` in der
`docker-compose.yml`) und löscht die ältesten. Ansehen mit `docker compose logs app`.

## Aktualität der Pakete

- **Wöchentlich** (montags) hebt der Workflow _Abhängigkeiten aktualisieren_ alle npm-Pakete auf die neueste Version,
  auch auf neue Hauptversionen. Er prüft Typen, Lint, Tests, Build und bekannte Sicherheitslücken und committet
  nur, wenn alles grün ist. Ist er rot, braucht es eine Anpassung im Code.
- **Täglich** läuft die CI zusätzlich, damit neu bekannte Sicherheitslücken auffallen.
- **Monatlich** schlägt Dependabot neue Versionen für GitHub Actions und das Docker-Basis-Image vor.
- Der Workflow lässt sich unter _Actions_ auch von Hand starten.

## Versionen und Release Notes

Jeder Pull Request mit sichtbaren Änderungen erhöht die Version in `package.json` und ergänzt
oben in `CHANGELOG.md` einen Eintrag in einfacher Sprache (Format steht in der Datei). Ein Test
prüft, dass beide zusammenpassen. Im Intranet erscheint das unter „Neu im Intranet“ (Fußzeile).
Nach dem Merge legt `.github/workflows/release.yml` ein GitHub-Release mit Tag `v<Version>` und
demselben Text an und veröffentlicht die Images in der GitHub Container Registry.

## Sicherheit

Siehe [SECURITY.md](SECURITY.md).

## Lizenz

[MIT](LICENSE)
