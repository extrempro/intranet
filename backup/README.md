# Sicherung und Wiederherstellung

Der Dienst `backup` in der `docker-compose.yml` sichert Datenbank und Dateien des Intranets. Den Zustand siehst du unter **Verwaltung → System**. Schlägt eine Sicherung fehl, bekommen die System-Admins eine Benachrichtigung (Thema „Betrieb und Sicherungen“).

## Was gesichert wird

| Teil                           | Wie                                   | Schutz                                                              |
| ------------------------------ | ------------------------------------- | ------------------------------------------------------------------- |
| Datenbank                      | `pg_dump` im custom format            | mit [age](https://age-encryption.org) verschlüsselt (`db.dump.age`) |
| Dateien (Anhänge, PDFs, Fotos) | Schnappschuss mit `rsync --link-dest` | schon einzeln verschlüsselt; Schlüssel liegen in der Datenbank      |

Unveränderte Dateien belegen in weiteren Schnappschüssen keinen Platz (feste Verknüpfungen). Die Datenbank-Sicherung ist jeden Tag vollständig.

Liegen Dateien in einem **S3-Speicher** (Verwaltung → Speicher), sichert dieser Dienst davon nur die Verweise und Schlüssel in der Datenbank. Die Dateien selbst sichert die Versionierung im Bucket; schalte sie dort ein und lege mit einer Lifecycle-Regel fest, wie lange alte Versionen bleiben.

Für eine Wiederherstellung brauchst du drei Dinge:

1. eine Sicherung aus dem Volume `backup-data`,
2. den **privaten age-Schlüssel** (nur im Passwortmanager),
3. den **`ENCRYPTION_KEY`** aus der `.env`. Ohne ihn lassen sich die Dateien und die zweiten Faktoren nicht entschlüsseln. Bewahre ihn getrennt vom Server auf, z. B. ebenfalls im Passwortmanager.

## Einrichten

1. Schlüsselpaar auf einem Arbeitsplatz erzeugen (nicht auf dem Server):

   ```sh
   age-keygen -o intranet-sicherung.key
   ```

   Die Ausgabe zeigt den öffentlichen Schlüssel (`age1…`). Die Datei mit dem privaten Schlüssel in den Passwortmanager legen und vom Arbeitsplatz löschen.

2. In die `.env` eintragen. Mehrere Schlüssel mit Leerzeichen trennen, z. B. für zwei Personen:

   ```
   BACKUP_AGE_RECIPIENTS=age1… age1…
   ```

3. Optional: `BACKUP_TIME` (Standard `01:15`, Europe/Berlin), `BACKUP_KEEP_DAYS` (Standard `30`), `RESTORE_TEST_DAYS` (Standard `7`).

4. `docker compose up -d`. Fehlt beim Start eine Sicherung der letzten 24 Stunden, sichert der Dienst sofort.

**Wichtig:** Das Volume `backup-data` liegt auf demselben Host. Lege es auf einen anderen Datenträger oder kopiere es regelmäßig nach außen (z. B. auf ein NAS). Die Sicherungen sind verschlüsselt und dürfen das Haus verlassen.

## Wiederherstellungstest

Alle `RESTORE_TEST_DAYS` Tage spielt der Dienst die neue Datenbank-Sicherung in eine Wegwerf-Datenbank im Container ein. Er prüft Tabellen, Migrationen und Personen und ob jede Datei aus der Datenbank im Schnappschuss liegt. Das Ergebnis steht unter Verwaltung → System.

Der Test läuft vor dem Verschlüsseln, denn der private Schlüssel liegt nicht auf dem Server. Prüfe deshalb zusätzlich etwa **einmal im Quartal von Hand**, ob sich eine Sicherung mit dem Schlüssel aus dem Passwortmanager entschlüsseln lässt:

```sh
docker compose cp backup:/backups/<Name>/db.dump.age .
age -d -i intranet-sicherung.key db.dump.age | pg_restore --list | head
```

## Prüfung im CI

Bei jedem CI-Lauf startet `backup/ci-test.sh` Datenbank, Anwendung und Sicherung mit der echten `docker-compose.yml`. Das Skript legt eine Datei an und prüft dann:

- die erste Sicherung samt Wiederherstellungstest,
- dass die Anwendung den Zustand lesen darf, die Sicherungen selbst aber nicht,
- dass unveränderte Dateien in der zweiten Sicherung keinen neuen Platz belegen,
- dass Wiederherstellen ohne Schlüssel scheitert und mit Schlüssel Datenbank und Dateien zurückholt.

## Sicherung von Hand

```sh
docker compose exec backup sicherung.sh
```

## Wiederherstellen

Ersetzt die Datenbank und **alle** Dateien durch den Stand der Sicherung. Was seitdem geschrieben wurde, geht verloren.

```sh
# 1. Vorhandene Sicherungen anzeigen
docker compose --profile wiederherstellen run --rm wiederherstellen

# 2. Anwendung anhalten
docker compose stop app

# 3. Wiederherstellen; der private Schlüssel kommt über stdin
docker compose --profile wiederherstellen run --rm -T wiederherstellen 2026-11-21_011500 < intranet-sicherung.key

# 4. Anwendung starten
docker compose start app
```

Das Skript prüft vorher die Prüfsumme und ob sich die Sicherung entschlüsseln lässt. Erst danach ersetzt es etwas. Nach dem Start spielt die Anwendung fehlende Migrationen ein und setzt das Passwort der App-Rolle.

Auf einem neuen Server: Repo auschecken, `.env` mit demselben `ENCRYPTION_KEY` anlegen, das Volume `backup-data` zurückkopieren, `docker compose up -d db`, dann ab Schritt 3.
