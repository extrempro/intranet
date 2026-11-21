#!/bin/sh
# Wiederherstellungstest (Kap. 18): spielt eine Datenbank-Sicherung in eine
# Wegwerf-Datenbank im Container ein und prüft sie.
#   pruefung.sh <db.dump (Klartext)> <Dateien-Schnappschuss> <Name>
# Ergebnis: $BACKUP_DIR/status/letzter-test.json
set -eu
: "${BACKUP_DIR:=/backups}"
DUMP=$1
DATEIEN=$2
NAME=$3
STATUS="$BACKUP_DIR/status"
mkdir -p "$STATUS"
START=$(date +%s)
iso() { date -d "@$1" +%Y-%m-%dT%H:%M:%S%z | sed 's/\(..\)$/:\1/'; }
# shellcheck disable=SC1003 # Backslash in tr ist gewollt, kein Anführungszeichen-Fehler
json_text() { printf '%s' "$1" | tr '\n\r\t"\\' '     ' | cut -c1-300; }

PGTEST=$(mktemp -d /tmp/pruefung.XXXXXX)
PORT=55432
als_pg() {
	if [ "$(id -u)" = 0 ]; then su-exec postgres "$@"; else "$@"; fi
}
stoppen() {
	als_pg pg_ctl -D "$PGTEST/data" -m immediate stop >/dev/null 2>&1 || true
	rm -rf "$PGTEST"
}
trap stoppen EXIT
[ "$(id -u)" = 0 ] && chown postgres "$PGTEST"

ergebnis() { # ok tabellen personen dateien fehlende meldung
	ende=$(date +%s)
	cat > "$STATUS/.letzter-test.json" <<JSON
{
  "zeit": "$(iso "$ende")",
  "epoch": $ende,
  "ok": $1,
  "name": "$NAME",
  "dauer_s": $((ende - START)),
  "tabellen": $2,
  "personen": $3,
  "dateien": $4,
  "fehlende_dateien": $5,
  "meldung": "$(json_text "$6")"
}
JSON
	chmod 644 "$STATUS/.letzter-test.json"
	mv "$STATUS/.letzter-test.json" "$STATUS/letzter-test.json"
}
fehler() {
	echo "Wiederherstellungstest: $1" >&2
	ergebnis false 0 0 0 0 "$1"
	exit 1
}

als_pg initdb -D "$PGTEST/data" -U pruefung --auth=trust >"$PGTEST/initdb.log" 2>&1 ||
	fehler "Wegwerf-Datenbank konnte nicht angelegt werden: $(tail -n 2 "$PGTEST/initdb.log")"
als_pg pg_ctl -D "$PGTEST/data" -w -l "$PGTEST/log" \
	-o "-c listen_addresses='' -k $PGTEST -p $PORT -c fsync=off" start >/dev/null 2>&1 ||
	fehler "Wegwerf-Datenbank startet nicht: $(tail -n 2 "$PGTEST/log" 2>/dev/null)"

q() { als_pg psql -X -q -At -h "$PGTEST" -p $PORT -U pruefung -d pruefung -c "$1"; }
als_pg createdb -h "$PGTEST" -p $PORT -U pruefung pruefung
# Richtlinien (Row-Level Security) nennen die Rolle der Anwendung
q "create role intranet_app nologin" >/dev/null
# Rollen der Anwendung gibt es hier nicht: ohne Eigentümer und Rechte einspielen.
# Über stdin, weil nur root die Sicherung lesen darf.
als_pg pg_restore --no-owner --no-privileges --exit-on-error \
	-h "$PGTEST" -p $PORT -U pruefung -d pruefung <"$DUMP" 2>"$PGTEST/restore.log" ||
	fehler "pg_restore ist fehlgeschlagen: $(grep -m 1 'error' "$PGTEST/restore.log")"

tabellen=$(q "select count(*) from information_schema.tables where table_schema='public'")
[ "$tabellen" -gt 0 ] || fehler "Keine Tabellen in der Sicherung."
migrationen=$(q "select count(*) from drizzle.__drizzle_migrations" 2>/dev/null || echo 0)
[ "$migrationen" -gt 0 ] || fehler "Migrationen fehlen in der Sicherung."
personen=$(q "select count(*) from persons")

# Jede Datei aus der Datenbank muss im Schnappschuss liegen (<2 Zeichen>/<ID>)
q "select id from files" > "$PGTEST/ids"
dateien=$(wc -l < "$PGTEST/ids" | tr -d ' ')
fehlend=0
while read -r id; do
	[ -n "$id" ] || continue
	p=$(printf '%s' "$id" | cut -c1-2)
	[ -f "$DATEIEN/$p/$id" ] || fehlend=$((fehlend + 1))
done < "$PGTEST/ids"

meldung=""
# Zwischen Datenbank und Dateien liegen Sekunden; einzelne in der Zeit gelöschte
# Dateien sind kein Fehler der Sicherung.
[ "$fehlend" -gt 0 ] && meldung="$fehlend von $dateien Dateien fehlen im Schnappschuss."
ok=true
[ "$fehlend" -gt 5 ] && ok=false
ergebnis $ok "$tabellen" "$personen" "$dateien" "$fehlend" "$meldung"
echo "Wiederherstellungstest $NAME: $tabellen Tabellen, $personen Personen, $dateien Dateien, $fehlend fehlen."
[ "$ok" = true ]
