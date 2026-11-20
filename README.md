# Intranet

Mandantenfähiges Intranet als Progressive Web App: Neuigkeiten, Abteilungen und Hubs, Kalender,
Pläne, Speiseplan, Schwarzes Brett, Nachrichten und eine Verwaltung.

Was das Intranet können soll, steht in der **[Spezifikation](docs/spec.md)**.

## Stack

- [SvelteKit](https://svelte.dev/docs/kit) mit TypeScript
- PostgreSQL mit [Drizzle ORM](https://orm.drizzle.team)
- Betrieb in Docker hinter dem Reverse Proxy, Bereitstellung per Compose

## Entwicklung

Voraussetzungen: Node.js 24 oder neuer, eine PostgreSQL-Datenbank (z. B. über `docker compose up db`).

```bash
cp .env.example .env        # Werte anpassen
npm install
npm run db:migrate          # sobald Migrationen vorhanden sind
npm run dev
```

| Befehl | Zweck |
|---|---|
| `npm run dev` | Entwicklungsserver |
| `npm run check` | Typen prüfen |
| `npm run lint` | Lint prüfen |
| `npm run format:check` | Formatierung prüfen (`npm run format` korrigiert) |
| `npm test` | Tests |
| `npm run build` | Produktions-Build |
| `npm run db:generate` | Migration aus dem Schema erzeugen |

## Betrieb

```bash
cp .env.example .env        # ORIGIN, Passwörter usw. setzen
docker compose up -d --build
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

Teams-Benachrichtigungen (dringende und angeheftete Beiträge) gehen über den Aktivitätsfeed von
Microsoft Graph (`TeamsActivity.Send`). Das App-Paket für das Teams Admin Center gibt es unter
Verwaltung → Benachrichtigungen. Der Tab der App (`/teams/tab`) ist die einzige Seite, die in Teams
eingebettet werden darf; er zeigt nur einen Link ins Intranet.

E-Mails (Einladungen, „Passwort vergessen“, Benachrichtigungen) gehen per **SMTP** raus
(`SMTP_*` und `MAIL_FROM` in der `.env` oder unter Verwaltung → Benachrichtigungen). Der Server
braucht dafür ausgehend Zugriff auf den SMTP-Server.

Sicherungen macht der Dienst `backup` (täglich, verschlüsselt, mit wöchentlichem
Wiederherstellungstest). Einrichten und Wiederherstellen: [backup/README.md](backup/README.md).

## Aktualität der Pakete

- **Wöchentlich** (montags) hebt der Workflow *Abhängigkeiten aktualisieren* alle npm-Pakete auf die neueste Version,
  auch auf neue Hauptversionen. Er prüft Typen, Lint, Tests, Build und bekannte Sicherheitslücken und committet
  nur, wenn alles grün ist. Ist er rot, braucht es eine Anpassung im Code.
- **Täglich** läuft die CI zusätzlich, damit neu bekannte Sicherheitslücken auffallen.
- **Monatlich** schlägt Dependabot neue Versionen für GitHub Actions und das Docker-Basis-Image vor.
- Der Workflow lässt sich unter *Actions* auch von Hand starten.

## Sicherheit

Siehe [SECURITY.md](SECURITY.md).

## Lizenz

[MIT](LICENSE)
