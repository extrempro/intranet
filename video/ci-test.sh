#!/usr/bin/env bash
# Prüft das Image der Umwandlung (Kap. 8.15) im CI: ohne Netz, schreibgeschützt,
# als Benutzer 1000. Erzeugt ein kurzes Testvideo mit Metadaten, wandelt es mit
# EINMAL=1 um und prüft Ergebnis, Untertitel (Whisper ohne Netz), entfernte Metadaten
# und gelöschtes Original; danach einen Vorschlag für Zusammenfassung und Kapitel
# (Sprachmodell ohne Netz).
#   bash video/ci-test.sh   (baut ghcr.io/extrempro/intranet-video:latest)
set -euo pipefail
cd "$(dirname "$0")/.."
IMAGE=ghcr.io/extrempro/intranet-video:latest
fehler() {
	echo "FEHLER: $1" >&2
	exit 1
}

docker build --quiet -t "$IMAGE" video >/dev/null
ARBEIT=$(mktemp -d)
trap 'docker run --rm -v "$ARBEIT:/a" --entrypoint sh "$IMAGE" -c "rm -rf /a/*" >/dev/null 2>&1; rm -rf "$ARBEIT"' EXIT
chmod 777 "$ARBEIT"
ID=11111111-1111-4111-8111-111111111111
mkdir -m 777 "$ARBEIT/$ID"

echo "== Testvideo erzeugen"
docker run --rm --network none -v "$ARBEIT:/arbeit" --entrypoint ffmpeg "$IMAGE" -v error \
	-f lavfi -i testsrc=size=1280x720:rate=25 -f lavfi -i sine=frequency=440 -t 3 \
	-metadata title=Geheimtitel -c:v libx264 -pix_fmt yuv420p -c:a aac -shortest \
	-f mp4 "/arbeit/$ID/eingang.bin"
docker run --rm -v "$ARBEIT:/arbeit" --entrypoint sh "$IMAGE" -c ": > /arbeit/$ID/untertitel; : > /arbeit/$ID/auftrag"

echo "== Umwandeln (ohne Netz, schreibgeschützt, ohne Rechte)"
docker run --rm --network none --read-only --tmpfs /tmp --cap-drop ALL \
	--security-opt no-new-privileges --memory 8g -e EINMAL=1 -e THREADS=2 -v "$ARBEIT:/arbeit" "$IMAGE"

[ -f "$ARBEIT/$ID/fehler" ] && fehler "Umwandlung: $(cat "$ARBEIT/$ID/fehler")"
[ -f "$ARBEIT/$ID/fertig" ] || fehler "keine Datei fertig"
grep -q 'dauer=3' "$ARBEIT/$ID/fertig" || fehler "Dauer falsch: $(cat "$ARBEIT/$ID/fertig")"
grep -q 'hoehen=360,720' "$ARBEIT/$ID/fertig" || fehler "Stufen falsch: $(cat "$ARBEIT/$ID/fertig")"
for f in aus/master.m3u8 aus/360/index.m3u8 aus/720/index.m3u8 aus/vorschau.jpg; do
	[ -s "$ARBEIT/$ID/$f" ] || fehler "$f fehlt"
done
ls "$ARBEIT/$ID"/aus/720/init*.mp4 >/dev/null 2>&1 || fehler "Init-Segment fehlt"
[ -e "$ARBEIT/$ID/eingang.bin" ] && fehler "Original nicht gelöscht"
if grep -rqa Geheimtitel "$ARBEIT/$ID/aus"; then fehler "Metadaten nicht entfernt"; fi
grep -q 'untertitel=ja' "$ARBEIT/$ID/fertig" || fehler "Untertitel nicht erzeugt: $(cat "$ARBEIT/$ID/fertig")"
head -n1 "$ARBEIT/$ID/aus/untertitel.vtt" | grep -q '^WEBVTT' || fehler "untertitel.vtt ist kein WebVTT"
echo "OK: Umwandlung und Untertitel im Container"

echo "== Vorschlag für Zusammenfassung und Kapitel (Sprachmodell ohne Netz)"
VORSCHLAG="vorschlag-$ID"
mkdir -m 777 "$ARBEIT/$VORSCHLAG"
cat >"$ARBEIT/$VORSCHLAG/eingabe.txt" <<'TEXT'
[0:00] Hallo und willkommen zur Einführung in die neue Zeiterfassung.
[0:20] Zuerst zeige ich dir, wie du dich am Terminal anmeldest.
[1:10] Halte dazu deinen Ausweis an das Lesegerät, bis es piept.
[2:30] Danach geht es um Pausen: Du buchst sie über die Taste Pause.
[3:45] Zum Schluss siehst du, wo du deine Stunden im Intranet nachschaust.
[4:30] Bei Fragen wende dich an die Personalabteilung.
TEXT
docker run --rm -v "$ARBEIT:/arbeit" --entrypoint sh "$IMAGE" -c ": > /arbeit/$VORSCHLAG/auftrag"
docker run --rm --network none --read-only --tmpfs /tmp --cap-drop ALL \
	--security-opt no-new-privileges --memory 8g -e EINMAL=1 -e THREADS=2 -v "$ARBEIT:/arbeit" "$IMAGE"
[ -f "$ARBEIT/$VORSCHLAG/fehler" ] && fehler "Vorschlag: $(cat "$ARBEIT/$VORSCHLAG/fehler")"
[ -s "$ARBEIT/$VORSCHLAG/ergebnis.json" ] || fehler "kein Vorschlag erstellt"
grep -q '"zusammenfassung"' "$ARBEIT/$VORSCHLAG/ergebnis.json" || fehler "Vorschlag ohne Zusammenfassung: $(cat "$ARBEIT/$VORSCHLAG/ergebnis.json")"
grep -q '"kapitel"' "$ARBEIT/$VORSCHLAG/ergebnis.json" || fehler "Vorschlag ohne Kapitel"
echo "OK: Vorschlag im Container"
cat "$ARBEIT/$VORSCHLAG/ergebnis.json"
