#!/bin/sh
# Stellt eine Sicherung wieder her: Datenbank UND Dateien (backup/README.md).
#   docker compose stop app
#   docker compose --profile wiederherstellen run --rm -T wiederherstellen <Name> < privater-schluessel.txt
#   docker compose start app
# Der private age-Schlüssel kommt über stdin und liegt nur im Arbeitsspeicher.
# ACHTUNG: Ersetzt die Datenbank $PGDATABASE und den Inhalt von /data/files.
set -eu
: "${BACKUP_DIR:=/backups}"
: "${FILES_DST:=/data/files}"
NAME=${1:-}

if [ -z "$NAME" ]; then
	echo "Aufruf: wiederherstellen.sh <Name> < privater-schluessel.txt" >&2
	echo "Vorhandene Sicherungen:" >&2
	find "$BACKUP_DIR" -mindepth 1 -maxdepth 1 -type d -name '20*' -exec basename {} \; | sort >&2
	exit 2
fi
case "$NAME" in
	20[0-9][0-9]-[01][0-9]-[0-3][0-9]_[0-9][0-9][0-9][0-9][0-9][0-9]) ;;
	*) echo "Ungültiger Name: $NAME" >&2; exit 2 ;;
esac
QUELLE="$BACKUP_DIR/$NAME"
[ -f "$QUELLE/db.dump.age" ] && [ -d "$QUELLE/dateien" ] || {
	echo "Sicherung $NAME nicht gefunden oder unvollständig." >&2
	exit 1
}
(cd "$QUELLE" && sha256sum -c -s SHA256SUMS) || {
	echo "Prüfsumme stimmt nicht: Die Sicherung ist beschädigt." >&2
	exit 1
}

ARBEIT=$(mktemp -d /tmp/wiederherstellen.XXXXXX)
trap 'rm -rf "$ARBEIT"' EXIT
cat > "$ARBEIT/schluessel"
chmod 600 "$ARBEIT/schluessel"
[ -s "$ARBEIT/schluessel" ] || { echo "Kein privater Schlüssel auf stdin." >&2; exit 1; }
age -d -i "$ARBEIT/schluessel" -o "$ARBEIT/db.dump" "$QUELLE/db.dump.age" || {
	echo "Entschlüsseln fehlgeschlagen: falscher Schlüssel?" >&2
	exit 1
}
rm -f "$ARBEIT/schluessel"
pg_restore --list "$ARBEIT/db.dump" >/dev/null || { echo "Die Sicherung ist kein gültiger Dump." >&2; exit 1; }

echo "Stelle Datenbank $PGDATABASE aus $NAME wieder her …"
dropdb --if-exists --force --maintenance-db=postgres "$PGDATABASE"
createdb --maintenance-db=postgres "$PGDATABASE"
pg_restore --exit-on-error -d "$PGDATABASE" "$ARBEIT/db.dump"

echo "Stelle Dateien wieder her …"
rsync -a --delete "$QUELLE/dateien/" "$FILES_DST/"

echo "Fertig. Starte jetzt die Anwendung: docker compose start app"
