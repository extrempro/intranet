#!/bin/sh
# Startet die Sicherung täglich zur Uhrzeit BACKUP_TIME (Europe/Berlin).
# Fehlt beim Start eine erfolgreiche Sicherung der letzten 24 Stunden, läuft
# sie sofort (z. B. nach einem Ausfall des Hosts).
set -eu
: "${BACKUP_TIME:=01:15}"
: "${BACKUP_DIR:=/backups}"

case "$BACKUP_TIME" in
	[01][0-9]:[0-5][0-9] | 2[0-3]:[0-5][0-9]) ;;
	*) echo "BACKUP_TIME muss HH:MM sein, ist: $BACKUP_TIME" >&2; exit 1 ;;
esac

letzter_erfolg() {
	f="$BACKUP_DIR/status/letzte-sicherung.json"
	[ -f "$f" ] || { echo 0; return; }
	sed -n 's/.*"erfolg_epoch": *\([0-9]*\).*/\1/p' "$f" | head -n 1 | grep . || echo 0
}

jetzt=$(date +%s)
if [ $((jetzt - $(letzter_erfolg))) -gt 86400 ]; then
	echo "Keine Sicherung der letzten 24 Stunden – sichere jetzt."
	sicherung.sh || true
fi

while :; do
	jetzt=$(date +%s)
	ziel=$(date -d "$(date +%Y-%m-%d) $BACKUP_TIME" +%s)
	if [ "$ziel" -le "$jetzt" ]; then
		morgen=$(date -d "@$((jetzt + 86400))" +%Y-%m-%d)
		ziel=$(date -d "$morgen $BACKUP_TIME" +%s)
	fi
	echo "Nächste Sicherung: $(date -d "@$ziel" '+%d.%m.%Y %H:%M')"
	sleep $((ziel - jetzt))
	sicherung.sh || true
done
