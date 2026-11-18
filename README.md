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
