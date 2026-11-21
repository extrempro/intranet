#!/usr/bin/env bash
# Prüft den Dienst backup im CI mit der echten docker-compose.yml (Images selbst gebaut):
#   1. Datenbank und Anwendung starten (Migrationen, erster Mandant)
#   2. eine Datei anlegen (Zeile in files und verschlüsselte Datei im Volume)
#   3. backup starten: erste Sicherung mit Wiederherstellungstest
#   4. zweite Sicherung von Hand (ohne Test, Dateien als feste Verknüpfung)
#   5. Datenbank und Dateien verändern, mit dem privaten Schlüssel wiederherstellen
# Aufruf aus dem Repo: bash backup/ci-test.sh
set -euo pipefail
cd "$(dirname "$0")/.."

export COMPOSE_PROJECT_NAME=intranet-ci
ENV=.env.ci-test
SCHLUESSEL=$(mktemp)
dc() { docker compose -f docker-compose.yml -f docker-compose.build.yml --env-file "$ENV" "$@"; }
aufraeumen() {
	status=$?
	if [ "$status" -ne 0 ]; then
		echo "::group::Logs"
		dc logs --no-color --tail=80 || true
		echo "::endgroup::"
	fi
	dc --profile wiederherstellen down -v --remove-orphans >/dev/null 2>&1 || true
	rm -f "$ENV" "$SCHLUESSEL"
	exit "$status"
}
trap aufraeumen EXIT
schritt() { echo "== $*"; }
fehler() { echo "FEHLER: $*" >&2; exit 1; }

cat >"$ENV" <<ENVDATEI
POSTGRES_USER=intranet
POSTGRES_PASSWORD=ci-$(openssl rand -hex 12)
POSTGRES_DB=intranet
APP_DATABASE_PASSWORD=ci-app-$(openssl rand -hex 12)
ENCRYPTION_KEY=$(openssl rand -base64 32)
ORIGIN=http://localhost:3999
APP_PORT=3999
RESTORE_TEST_DAYS=7
ENVDATEI

schritt "Images bauen"
dc build --quiet app backup

schritt "Schlüsselpaar für die Sicherung"
dc run --rm --no-deps --entrypoint age-keygen backup >"$SCHLUESSEL" 2>/dev/null
OEFFENTLICH=$(sed -n 's/^# public key: //p' "$SCHLUESSEL")
[[ "$OEFFENTLICH" == age1* ]] || fehler "kein öffentlicher Schlüssel erzeugt"
echo "BACKUP_AGE_RECIPIENTS=$OEFFENTLICH" >>"$ENV"

schritt "Datenbank und Anwendung starten"
dc up -d db app
for _ in $(seq 1 60); do
	curl -fsS http://localhost:3999/health >/dev/null 2>&1 && break
	sleep 2
done
curl -fsS http://localhost:3999/health >/dev/null || fehler "Anwendung startet nicht"

schritt "Einrichtungslink im Log"
LINK=$(dc logs app 2>/dev/null | grep -o 'http://localhost:3999/einrichtung/[A-Za-z0-9_-]*' | tail -n1)
[ -n "$LINK" ] || fehler "kein Einrichtungslink im Log"
curl -fsS "$LINK" | grep -q 'Hauptmandant' || fehler "Einrichtungsseite zeigt keinen Schritt Hauptmandant"

psql() { dc exec -T db psql -X -q -At -U intranet -d intranet -c "$1"; }

schritt "Testdatei anlegen"
ID=$(psql "select gen_random_uuid()")
psql "insert into files (id, name, mime, kind, size, key_enc) values ('$ID', 'ci.pdf', 'application/pdf', 'pdf', 4, 'ci')"
# Die Anwendung läuft schreibgeschützt; Datei als Benutzer node ins Volume legen
dc exec -T app sh -c "mkdir -p /data/files/${ID:0:2} && printf 'test' > /data/files/${ID:0:2}/$ID"

schritt "Dienst backup starten: erste Sicherung mit Wiederherstellungstest"
dc up -d backup
for _ in $(seq 1 60); do
	dc exec -T backup test -f /backups/status/letzter-test.json 2>/dev/null && break
	sleep 2
done
LETZTE=$(dc exec -T backup cat /backups/status/letzte-sicherung.json)
TEST=$(dc exec -T backup cat /backups/status/letzter-test.json)
echo "$LETZTE"
echo "$TEST"
grep -q '"ok": true' <<<"$LETZTE" || fehler "erste Sicherung nicht ok"
grep -q '"ok": true' <<<"$TEST" || fehler "Wiederherstellungstest nicht ok"
grep -q '"dateien": 1' <<<"$TEST" || fehler "Testdatei fehlt im Wiederherstellungstest"
grep -q '"fehlende_dateien": 0' <<<"$TEST" || fehler "Dateien fehlen im Schnappschuss"
ERSTE=$(sed -n 's/.*"name": "\([^"]*\)".*/\1/p' <<<"$LETZTE")

schritt "Zustand für Verwaltung → System lesbar (Benutzer der Anwendung)"
dc exec -T app cat /data/backups/status/letzte-sicherung.json >/dev/null ||
	fehler "Anwendung kann den Zustand nicht lesen"
if dc exec -T app ls "/data/backups/$ERSTE" >/dev/null 2>&1; then
	fehler "Anwendung darf die Sicherungen selbst nicht lesen"
fi

schritt "Zweite Sicherung von Hand (ohne Test)"
sleep 1
dc exec -T backup sicherung.sh
ZWEITE=$(dc exec -T backup sh -c "ls -1 /backups | grep '^20' | sort | tail -n 1")
[ "$ZWEITE" != "$ERSTE" ] || fehler "keine zweite Sicherung"
INODES=$(dc exec -T backup stat -c %i "/backups/$ERSTE/dateien/${ID:0:2}/$ID" "/backups/$ZWEITE/dateien/${ID:0:2}/$ID" | sort -u | wc -l)
[ "$INODES" -eq 1 ] || fehler "unveränderte Datei belegt in der zweiten Sicherung neuen Platz"

schritt "Veränderungen, die die Wiederherstellung zurücknehmen muss"
psql "delete from files where id = '$ID'"
psql "create table nach_der_sicherung (x int)"
dc exec -T app rm "/data/files/${ID:0:2}/$ID"

schritt "Wiederherstellen mit dem privaten Schlüssel"
dc stop app
if dc --profile wiederherstellen run --rm -T wiederherstellen "$ERSTE" </dev/null >/dev/null 2>&1; then
	fehler "Wiederherstellen ohne Schlüssel darf nicht gehen"
fi
dc --profile wiederherstellen run --rm -T wiederherstellen "$ERSTE" <"$SCHLUESSEL"
[ "$(psql "select count(*) from files where id = '$ID'")" = 1 ] || fehler "Dateizeile nicht wiederhergestellt"
[ "$(psql "select to_regclass('public.nach_der_sicherung') is null")" = t ] ||
	fehler "Datenbank enthält noch Änderungen nach der Sicherung"
dc start app
for _ in $(seq 1 60); do
	curl -fsS http://localhost:3999/health >/dev/null 2>&1 && break
	sleep 2
done
curl -fsS http://localhost:3999/health >/dev/null || fehler "Anwendung startet nach dem Wiederherstellen nicht"
[ "$(dc exec -T app cat "/data/files/${ID:0:2}/$ID")" = test ] || fehler "Datei nicht wiederhergestellt"

echo "Sicherung und Wiederherstellung: alles in Ordnung."
