#!/bin/sh
# Sicherung von Datenbank und Dateien (Kap. 18).
#
# - Datenbank: pg_dump (custom format), mit age verschlüsselt (db.dump.age).
# - Dateien: Schnappschuss des Volumes mit rsync --link-dest. Die Dateien sind
#   bereits einzeln verschlüsselt und ändern sich nie (neue ID je Datei), daher
#   belegen unveränderte Dateien in jedem weiteren Schnappschuss keinen Platz.
#   Ohne Datenbank (Schlüssel) und ENCRYPTION_KEY sind sie wertlos.
# - Aufbewahrung: BACKUP_KEEP_DAYS (Standard 30) Tage.
# - Wiederherstellungstest: alle RESTORE_TEST_DAYS (Standard 7) Tage spielt
#   pruefung.sh die neue Sicherung in eine Wegwerf-Datenbank ein. Der Test
#   läuft vor dem Verschlüsseln, denn der private Schlüssel liegt nicht auf dem
#   Server.
# - Zustand für die Verwaltung → System: $BACKUP_DIR/status/*.json
#
# Aufruf von Hand: docker compose exec backup sicherung.sh
set -eu
: "${BACKUP_DIR:=/backups}"
: "${FILES_SRC:=/data/files}"
: "${BACKUP_KEEP_DAYS:=30}"
: "${RESTORE_TEST_DAYS:=7}"
: "${BACKUP_TIME:=01:15}"
: "${BACKUP_AGE_RECIPIENTS:=}"

STATUS="$BACKUP_DIR/status"
mkdir -p "$STATUS"
# Die Anwendung liest nur status/ (Volume read-only, Benutzer node). Die
# Sicherungen selbst sind nur für root lesbar.
chmod 711 "$BACKUP_DIR"
chmod 755 "$STATUS"

# Nur eine Sicherung gleichzeitig
SPERRE=/tmp/sicherung.sperre
if ! mkdir "$SPERRE" 2>/dev/null; then
	echo "Es läuft bereits eine Sicherung." >&2
	exit 1
fi
ARBEIT=$(mktemp -d /tmp/sicherung.XXXXXX)
NAME=$(date +%Y-%m-%d_%H%M%S)
ZIEL="$BACKUP_DIR/.laufend-$NAME"
aufraeumen() {
	rm -rf "$ARBEIT" "$ZIEL"
	rmdir "$SPERRE" 2>/dev/null || true
}
trap aufraeumen EXIT

START=$(date +%s)
iso() { date -d "@$1" +%Y-%m-%dT%H:%M:%S%z | sed 's/\(..\)$/:\1/'; }
# Text für JSON: nur eine Zeile, ohne Anführungszeichen und Backslashes
# shellcheck disable=SC1003 # Backslash in tr ist gewollt, kein Anführungszeichen-Fehler
json_text() { printf '%s' "$1" | tr '\n\r\t"\\' '     ' | cut -c1-300; }

status_schreiben() { # ok meldung
	ende=$(date +%s)
	erfolg_epoch=0
	if [ "$1" = true ]; then
		erfolg_epoch=$ende
	elif [ -f "$STATUS/letzte-sicherung.json" ]; then
		erfolg_epoch=$(sed -n 's/.*"erfolg_epoch": *\([0-9]*\).*/\1/p' "$STATUS/letzte-sicherung.json" | head -n 1)
		erfolg_epoch=${erfolg_epoch:-0}
	fi
	cat > "$STATUS/.letzte-sicherung.json" <<JSON
{
  "zeit": "$(iso "$ende")",
  "ok": $1,
  "name": "$NAME",
  "dauer_s": $((ende - START)),
  "meldung": "$(json_text "$2")",
  "erfolg_epoch": $erfolg_epoch,
  "aufbewahrung_tage": $BACKUP_KEEP_DAYS,
  "test_alle_tage": $RESTORE_TEST_DAYS,
  "uhrzeit": "$BACKUP_TIME",
  "empfaenger": $(printf '%s' "$BACKUP_AGE_RECIPIENTS" | wc -w)
}
JSON
	chmod 644 "$STATUS/.letzte-sicherung.json"
	mv "$STATUS/.letzte-sicherung.json" "$STATUS/letzte-sicherung.json"
}

liste_schreiben() {
	{
		printf '[\n'
		erstes=true
		for d in $(find "$BACKUP_DIR" -mindepth 1 -maxdepth 1 -type d -name '20*' | sort -r); do
			[ -f "$d/inhalt.json" ] || continue
			[ "$erstes" = true ] || printf ',\n'
			erstes=false
			cat "$d/inhalt.json"
		done
		printf ']\n'
	} > "$STATUS/.sicherungen.json"
	chmod 644 "$STATUS/.sicherungen.json"
	mv "$STATUS/.sicherungen.json" "$STATUS/sicherungen.json"
}

fehler() {
	echo "Sicherung fehlgeschlagen: $1" >&2
	status_schreiben false "$1"
	exit 1
}

# Öffentliche age-Schlüssel (age1…), mit Leerzeichen getrennt
[ -n "$BACKUP_AGE_RECIPIENTS" ] ||
	fehler "BACKUP_AGE_RECIPIENTS fehlt in der .env (öffentliche age-Schlüssel)."
empfaenger=""
for r in $BACKUP_AGE_RECIPIENTS; do
	case "$r" in
		age1*) empfaenger="$empfaenger -r $r" ;;
		*) fehler "BACKUP_AGE_RECIPIENTS enthält etwas anderes als age-Schlüssel." ;;
	esac
done

mkdir -p "$ZIEL"
chmod 700 "$ZIEL"

# --- Wiederherstellungstest fällig? ---
test_faellig=false
letzter_test=0
if [ -f "$STATUS/letzter-test.json" ]; then
	letzter_test=$(sed -n 's/.*"epoch": *\([0-9]*\).*/\1/p' "$STATUS/letzter-test.json" | head -n 1)
	letzter_test=${letzter_test:-0}
fi
# eine Stunde Spielraum, damit der Test nicht um einen Tag wandert
[ $((START - letzter_test)) -ge $((RESTORE_TEST_DAYS * 86400 - 3600)) ] && test_faellig=true

# --- Datenbank ---
if [ "$test_faellig" = true ]; then
	pg_dump --format=custom --file="$ARBEIT/db.dump" || fehler "pg_dump ist fehlgeschlagen."
	# shellcheck disable=SC2086
	age $empfaenger -o "$ZIEL/db.dump.age" "$ARBEIT/db.dump" || fehler "Verschlüsseln ist fehlgeschlagen."
else
	# Ohne Test direkt verschlüsselt schreiben: kein Klartext auf der Platte
	# shellcheck disable=SC3040 # ash in Alpine (busybox) kennt pipefail
	set -o pipefail 2>/dev/null || true
	# shellcheck disable=SC2086
	pg_dump --format=custom | age $empfaenger -o "$ZIEL/db.dump.age" ||
		fehler "pg_dump oder Verschlüsseln ist fehlgeschlagen."
fi
[ -s "$ZIEL/db.dump.age" ] || fehler "Die Datenbank-Sicherung ist leer."

# --- Dateien ---
VORHER=$(find "$BACKUP_DIR" -mindepth 1 -maxdepth 1 -type d -name '20*' | sort | tail -n 1)
if [ -n "$VORHER" ] && [ -d "$VORHER/dateien" ]; then
	rsync -a --delete --link-dest="$VORHER/dateien/" "$FILES_SRC/" "$ZIEL/dateien/" ||
		fehler "Dateien konnten nicht gesichert werden."
else
	rsync -a --delete "$FILES_SRC/" "$ZIEL/dateien/" || fehler "Dateien konnten nicht gesichert werden."
fi

(cd "$ZIEL" && sha256sum db.dump.age > SHA256SUMS)
db_bytes=$(stat -c %s "$ZIEL/db.dump.age")
dateien=$(find "$ZIEL/dateien" -type f | wc -l)
dateien_bytes=$(find "$ZIEL/dateien" -type f -exec stat -c %s {} + | awk '{s += $1} END {print s + 0}')
cat > "$ZIEL/inhalt.json" <<JSON
{
  "name": "$NAME",
  "zeit": "$(iso "$START")",
  "db_bytes": $db_bytes,
  "dateien": $dateien,
  "dateien_bytes": $dateien_bytes
}
JSON

mv "$ZIEL" "$BACKUP_DIR/$NAME"
ZIEL=""

# --- Wiederherstellungstest ---
if [ "$test_faellig" = true ]; then
	pruefung.sh "$ARBEIT/db.dump" "$BACKUP_DIR/$NAME/dateien" "$NAME" ||
		echo "Wiederherstellungstest fehlgeschlagen, siehe letzter-test.json" >&2
	rm -f "$ARBEIT/db.dump"
fi

# --- Aufbewahrung (nur nach Erfolg, die neue Sicherung bleibt also immer) ---
grenze=$(date -d "@$((START - BACKUP_KEEP_DAYS * 86400))" +%Y%m%d%H%M%S)
find "$BACKUP_DIR" -mindepth 1 -maxdepth 1 -type d -name '20*' | sort | while read -r alt; do
	n=$(basename "$alt")
	[ "$n" = "$NAME" ] && continue
	zahl=$(printf '%s' "$n" | tr -d '_-')
	if [ "$zahl" -lt "$grenze" ]; then rm -rf "$alt"; echo "Entfernt: $n"; fi
done
# Reste abgebrochener Läufe
find "$BACKUP_DIR" -mindepth 1 -maxdepth 1 -type d -name '.laufend-*' -exec rm -rf {} +

liste_schreiben
status_schreiben true ""
echo "Sicherung $NAME fertig: Datenbank $db_bytes Bytes, $dateien Dateien."
