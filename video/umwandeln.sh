#!/bin/sh
# Wandelt hochgeladene Videos der Mediathek um (Kap. 8.15). Läuft im eigenen
# Container ohne Netz; Austausch mit der Anwendung nur über den Arbeitsordner:
#   <ARBEIT>/<id>/eingang.bin   hochgeladenes Original (schreibt die Anwendung)
#   <ARBEIT>/<id>/auftrag       Auftrag liegt vor (schreibt die Anwendung)
#   <ARBEIT>/<id>/laeuft        wird gerade umgewandelt
#   <ARBEIT>/<id>/fortschritt   Prozent (0–100)
#   <ARBEIT>/<id>/aus/          HLS (master.m3u8, <Höhe>/…), vorschau.jpg
#   <ARBEIT>/<id>/untertitel    Untertitel erzeugen (schreibt die Anwendung)
#   <ARBEIT>/<id>/aus/untertitel.vtt  erzeugte Untertitel (Whisper, lokal)
#   <ARBEIT>/<id>/fertig        dauer=<Sekunden>, hoehen=<360,720,…>, untertitel=<ja|nein|fehler>
#   <ARBEIT>/<id>/fehler        kurze Meldung
# Das Original wird danach immer gelöscht. Immer nur eine Umwandlung gleichzeitig.
#
# Vorschlag für Zusammenfassung und Kapitel (Sprachmodell, lokal mit llama.cpp):
#   <ARBEIT>/vorschlag-<id>/eingabe.txt    Untertitel mit Zeitmarken (schreibt die Anwendung)
#   <ARBEIT>/vorschlag-<id>/auftrag        Auftrag liegt vor (schreibt die Anwendung)
#   <ARBEIT>/vorschlag-<id>/laeuft         wird gerade erstellt
#   <ARBEIT>/vorschlag-<id>/ergebnis.json  Antwort des Modells (prüft die Anwendung)
#   <ARBEIT>/vorschlag-<id>/fehler         kurze Meldung
# Umwandlungen haben Vorrang, Vorschläge laufen danach.
set -u
ARBEIT="${ARBEIT:-/arbeit}"
MAX_SEKUNDEN="${MAX_SEKUNDEN:-10800}"
PAUSE="${PAUSE:-5}"
MODELL="${MODELL:-/modelle/ggml-large-v3-turbo-q5_0.bin}"
SPRACHMODELL="${SPRACHMODELL:-/modelle/sprachmodell.gguf}"
VORLAGE="${VORLAGE:-/usr/local/share/vorschlag}"
KONTEXT="${KONTEXT:-32768}"
THREADS=$(printf "%s" "${THREADS:-2}" | cut -d. -f1)
case "$THREADS" in "" | *[!0-9]* | 0) THREADS=1 ;; esac

fehler() {
	printf '%s\n' "$2" >"$1/fehler"
	rm -f "$1/eingang.bin" "$1/laeuft"
	rm -rf "$1/aus"
}

umwandeln() {
	d="$1"
	ein="$d/eingang.bin"
	: >"$d/laeuft"
	echo 0 >"$d/fortschritt"
	[ -s "$ein" ] || { fehler "$d" 'Die Datei ist leer.'; return; }

	dauer=$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$ein" 2>/dev/null | head -n1)
	hoehe=$(ffprobe -v error -select_streams v:0 -show_entries stream=height -of default=nw=1:nk=1 "$ein" 2>/dev/null | head -n1)
	ton=$(ffprobe -v error -select_streams a:0 -show_entries stream=index -of default=nw=1:nk=1 "$ein" 2>/dev/null | head -n1)
	case "$hoehe" in '' | *[!0-9]*) fehler "$d" 'Das ist keine Videodatei, die sich umwandeln lässt.'; return ;; esac
	sek=$(printf '%s' "$dauer" | cut -d. -f1)
	case "$sek" in '' | *[!0-9]*) fehler "$d" 'Die Länge des Videos lässt sich nicht lesen.'; return ;; esac
	# Mit Untertiteln: Umwandeln bis 60 %, Spracherkennung bis 100 %
	anteil=100
	mit_ut=nein
	if [ -f "$d/untertitel" ] && [ -n "$ton" ] && [ -f "$MODELL" ] && command -v whisper-cli >/dev/null; then
		anteil=60
		mit_ut=ja
	fi
	[ "$sek" -ge 1 ] || { fehler "$d" 'Das Video ist zu kurz.'; return; }
	[ "$sek" -le "$MAX_SEKUNDEN" ] || { fehler "$d" 'Das Video ist länger als 3 Stunden.'; return; }

	# Qualitätsstufen bis zur Höhe des Originals (mindestens eine)
	stufen=''
	for h in 360 720 1080; do [ "$hoehe" -ge "$h" ] && stufen="$stufen $h"; done
	[ -n "$stufen" ] || stufen=" $(( (hoehe / 2) * 2 ))"
	# shellcheck disable=SC2086 # Liste bewusst aufgeteilt (nur Ziffern)
	set -- $stufen
	n=$#

	filter="[0:v]split=$n"
	i=0; for h in "$@"; do filter="${filter}[s$i]"; i=$((i + 1)); done
	i=0; for h in "$@"; do filter="${filter};[s$i]scale=-2:$h,format=yuv420p[v$i]"; i=$((i + 1)); done

	rm -rf "$d/aus"; mkdir -p "$d/aus"
	karte=''
	argumente=''
	i=0
	for h in "$@"; do
		case "$h" in 360) rate=800k ;; 720) rate=2800k ;; 1080) rate=5000k ;; *) rate=600k ;; esac
		argumente="$argumente -map [v$i] -c:v:$i libx264 -preset veryfast -profile:v main -b:v:$i $rate -maxrate:v:$i $rate -bufsize:v:$i $rate"
		if [ -n "$ton" ]; then
			argumente="$argumente -map 0:a:0"
			karte="$karte v:$i,a:$i,name:$h"
		else
			karte="$karte v:$i,name:$h"
		fi
		i=$((i + 1))
	done
	[ -n "$ton" ] && argumente="$argumente -c:a aac -b:a 128k -ac 2"

	# shellcheck disable=SC2086 # Argumente bewusst aufgeteilt
	ffmpeg -hide_banner -nostdin -loglevel error -y -i "$ein" -map_metadata -1 -map_chapters -1 \
		-filter_complex "$filter" $argumente \
		-g 48 -keyint_min 48 -sc_threshold 0 \
		-f hls -hls_time 6 -hls_playlist_type vod -hls_segment_type fmp4 \
		-hls_flags independent_segments -hls_fmp4_init_filename init.mp4 \
		-hls_segment_filename "$d/aus/%v/s%05d.m4s" -master_pl_name master.m3u8 \
		-var_stream_map "${karte# }" -progress "$d/progress.txt" "$d/aus/%v/index.m3u8" \
		2>"$d/ffmpeg.log" &
	pid=$!
	while kill -0 "$pid" 2>/dev/null; do
		us=$(grep '^out_time_us=' "$d/progress.txt" 2>/dev/null | tail -n1 | cut -d= -f2)
		case "$us" in '' | *[!0-9]*) ;; *) echo $(( us * anteil / sek / 1000000 )) >"$d/fortschritt" ;; esac
		sleep 2
	done
	if ! wait "$pid"; then
		fehler "$d" 'Das Video ließ sich nicht umwandeln.'
		rm -f "$d/progress.txt"
		return
	fi
	ffmpeg -hide_banner -nostdin -loglevel error -y -ss $(( sek / 10 )) -i "$ein" -frames:v 1 \
		-vf scale=640:-2 -q:v 4 -map_metadata -1 "$d/aus/vorschau.jpg" 2>>"$d/ffmpeg.log" || true
	rm -f "$d/progress.txt" "$d/ffmpeg.log"
	ut=nein
	if [ "$mit_ut" = ja ]; then
		if untertitel "$d"; then ut=ja; else ut=fehler; fi
	fi
	rm -f "$ein"
	hoehen=$(printf '%s' "$*" | tr ' ' ',')
	printf 'dauer=%s\nhoehen=%s\nuntertitel=%s\n' "$sek" "$hoehen" "$ut" >"$d/fertig.tmp"
	echo 100 >"$d/fortschritt"
	mv "$d/fertig.tmp" "$d/fertig"
	rm -f "$d/laeuft"
}

# Spracherkennung mit Whisper (whisper.cpp), lokal und ohne Netz. Ergebnis: aus/untertitel.vtt
untertitel() {
	d="$1"
	ffmpeg -hide_banner -nostdin -loglevel error -y -i "$d/eingang.bin" -vn -map 0:a:0 -ac 1 -ar 16000 \
		-c:a pcm_s16le -map_metadata -1 "$d/ton.wav" 2>/dev/null || { rm -f "$d/ton.wav"; return 1; }
	whisper-cli -m "$MODELL" -l de -t "$THREADS" -pp -ovtt -of "$d/aus/untertitel" -f "$d/ton.wav" \
		>"$d/whisper.log" 2>&1 &
	wpid=$!
	while kill -0 "$wpid" 2>/dev/null; do
		p=$(grep -o 'progress = *[0-9]*' "$d/whisper.log" 2>/dev/null | tail -n1 | grep -o '[0-9]*$')
		case "$p" in '' | *[!0-9]*) ;; *) echo $(( 60 + p * 40 / 100 )) >"$d/fortschritt" ;; esac
		sleep 3
	done
	wait "$wpid"
	ok=$?
	rm -f "$d/ton.wav" "$d/whisper.log"
	[ "$ok" -eq 0 ] && [ -s "$d/aus/untertitel.vtt" ] || { rm -f "$d/aus/untertitel.vtt"; return 1; }
}

# Vorschlag für Zusammenfassung und Kapitel aus den Untertiteln (llama.cpp, ohne Netz)
vfehler() {
	printf '%s\n' "$2" >"$1/fehler"
	rm -f "$1/laeuft" "$1/ausgabe.txt" "$1/llama.log" "$1/eingabe.txt"
}

vorschlag() {
	d="$1"
	: >"$d/laeuft"
	[ -s "$d/eingabe.txt" ] || { vfehler "$d" 'Es gibt keinen Text für den Vorschlag.'; return; }
	if [ ! -f "$SPRACHMODELL" ] || ! command -v llama-completion >/dev/null; then
		vfehler "$d" 'Das Sprachmodell fehlt im Dienst video.'
		return
	fi
	llama-completion -m "$SPRACHMODELL" --jinja -rea off -st --no-display-prompt --no-warmup \
		-c "$KONTEXT" -n 1500 -t "$THREADS" --temp 0.3 --top-p 0.9 \
		-sysf "$VORLAGE/system.txt" --json-schema-file "$VORLAGE/schema.json" \
		-f "$d/eingabe.txt" </dev/null >"$d/ausgabe.txt" 2>"$d/llama.log"
	ok=$?
	if [ "$ok" -ne 0 ] || ! grep -q '{' "$d/ausgabe.txt" 2>/dev/null; then
		vfehler "$d" 'Das Sprachmodell hat keinen Vorschlag geliefert.'
		return
	fi
	# Nur das JSON-Objekt behalten; die Anwendung prüft den Inhalt
	tr '\n' ' ' <"$d/ausgabe.txt" | sed -e 's/^[^{]*//' -e 's/}[^}]*$/}/' >"$d/ergebnis.tmp"
	mv "$d/ergebnis.tmp" "$d/ergebnis.json"
	rm -f "$d/ausgabe.txt" "$d/llama.log" "$d/eingabe.txt" "$d/laeuft"
}

echo "Umwandlung bereit, Arbeitsordner $ARBEIT"
while :; do
	for d in "$ARBEIT"/*/; do
		d=${d%/}
		[ -f "$d/auftrag" ] || continue
		[ -e "$d/fertig" ] || [ -e "$d/fehler" ] && continue
		case "${d##*/}" in
			vorschlag-*) continue ;;
		esac
		# Abgebrochener Lauf (Neustart): neu beginnen, sofern das Original noch da ist
		umwandeln "$d"
	done
	# Danach ein Vorschlag je Runde, damit neue Umwandlungen nicht lange warten
	for d in "$ARBEIT"/vorschlag-*/; do
		d=${d%/}
		[ -f "$d/auftrag" ] || continue
		[ -e "$d/ergebnis.json" ] || [ -e "$d/fehler" ] && continue
		vorschlag "$d"
		break
	done
	[ "${EINMAL:-}" = 1 ] && exit 0
	sleep "$PAUSE"
done
