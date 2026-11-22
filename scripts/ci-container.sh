#!/usr/bin/env bash
# Rauchtest des Containers im CI mit der echten docker-compose.yml (Images selbst gebaut):
#   1. docker-compose.yml ist gültig (auch ohne die Datei zum Selbstbauen)
#   2. Anwendung startet, /health antwortet, Docker meldet „healthy“
#   3. Port nur auf der Adresse aus APP_BIND (hier 127.0.0.1)
#   4. läuft als Benutzer node (nicht root), Dateisystem schreibgeschützt,
#      no-new-privileges, nur /data/files und /tmp beschreibbar
#   5. Sicherheits-Header und Fehlerseite ohne Interna
#   6. Neustart und neu erstellter Container behalten Datenbank und Dateien
# Aufruf aus dem Repo: bash scripts/ci-container.sh
set -euo pipefail
cd "$(dirname "$0")/.."

export COMPOSE_PROJECT_NAME=intranet-rauchtest
ENV=.env.ci-container
URL=http://127.0.0.1:3998
dc() { docker compose -f docker-compose.yml -f docker-compose.build.yml --env-file "$ENV" "$@"; }
aufraeumen() {
	status=$?
	if [ "$status" -ne 0 ]; then
		echo "::group::Logs"
		dc logs --no-color --tail=80 || true
		echo "::endgroup::"
	fi
	dc down -v --remove-orphans >/dev/null 2>&1 || true
	rm -f "$ENV"
	exit "$status"
}
trap aufraeumen EXIT
schritt() { echo "== $*"; }
fehler() {
	echo "FEHLER: $*" >&2
	exit 1
}

cat >"$ENV" <<ENVDATEI
POSTGRES_USER=intranet
POSTGRES_PASSWORD=ci-$(openssl rand -hex 12)
POSTGRES_DB=intranet
APP_DATABASE_PASSWORD=ci-app-$(openssl rand -hex 12)
ENCRYPTION_KEY=$(openssl rand -base64 32)
ORIGIN=http://localhost:3998
APP_BIND=127.0.0.1
APP_PORT=3998
ENVDATEI

schritt "docker-compose.yml gültig"
docker compose -f docker-compose.yml --env-file "$ENV" config --quiet || fehler "docker-compose.yml ungültig"
# Ohne Pflichtwerte muss Compose mit klarer Meldung abbrechen
if docker compose -f docker-compose.yml --env-file /dev/null config --quiet 2>/dev/null; then
	fehler "Compose startet ohne ENCRYPTION_KEY und APP_DATABASE_PASSWORD"
fi

schritt "Image bauen und starten"
dc build --quiet app
dc up -d --wait --wait-timeout 180 db app || fehler "Anwendung wird nicht healthy"
[ "$(curl -fsS "$URL/health")" = "ok" ] || fehler "/health antwortet nicht mit ok"

schritt "Port nur auf 127.0.0.1"
PORTS=$(dc port app 3000)
echo "$PORTS"
[ "$PORTS" = "127.0.0.1:3998" ] || fehler "Port nicht nur auf 127.0.0.1: $PORTS"

schritt "Benutzer, Dateisystem, Rechte"
CID=$(dc ps -q app)
[ "$(dc exec -T app id -u)" != "0" ] || fehler "Anwendung läuft als root"
[ "$(docker inspect -f '{{.HostConfig.ReadonlyRootfs}}' "$CID")" = "true" ] || fehler "Dateisystem nicht schreibgeschützt"
docker inspect -f '{{.HostConfig.SecurityOpt}}' "$CID" | grep -q 'no-new-privileges:true' || fehler "no-new-privileges fehlt"
if dc exec -T app sh -c 'touch /app/build/x' 2>/dev/null; then fehler "/app ist beschreibbar"; fi
dc exec -T app sh -c 'touch /tmp/x && touch /data/files/.rauchtest' || fehler "/tmp oder /data/files nicht beschreibbar"

schritt "Daten anlegen"
psql() { dc exec -T db psql -X -q -At -U intranet -d intranet -c "$1"; }
psql "insert into tenants (id, name, short_name, is_main) values ('00000000-0000-4000-8000-00000000f001', 'Rauchtest', 'RT', true)"
dc exec -T app sh -c 'printf rauchtest > /data/files/rauchtest'

schritt "Sicherheits-Header und Fehlerseite (mit Mandant, damit die Anmeldung erscheint)"
KOPF=$(curl -sS -o /dev/null -D - "$URL/anmelden" | tr -d '\r')
for h in 'content-security-policy:' 'x-content-type-options: nosniff' 'referrer-policy:' 'strict-transport-security:'; do
	grep -qi "^$h" <<<"$KOPF" || fehler "Header fehlt: $h"
done
FEHLER=$(curl -sS "$URL/gibt-es-nicht-$(openssl rand -hex 4)")
if grep -qiE 'node_modules|at [a-zA-Z]+ \(|stack' <<<"$FEHLER"; then fehler "Fehlerseite zeigt Interna"; fi

pruefen() {
	[ "$(curl -fsS "$URL/health")" = "ok" ] || fehler "/health nach $1"
	[ "$(psql "select name from tenants where short_name = 'RT'")" = "Rauchtest" ] || fehler "Datenbank nach $1 leer"
	[ "$(dc exec -T app cat /data/files/rauchtest)" = "rauchtest" ] || fehler "Datei nach $1 weg"
}

schritt "Neustart behält Daten"
dc restart app db
dc up -d --wait --wait-timeout 180 db app
pruefen "Neustart"

schritt "Neu erstellter Container behält Daten"
dc down
dc up -d --wait --wait-timeout 180 db app
pruefen "neuem Container"
if dc exec -T app test -e /tmp/x; then fehler "/tmp im neuen Container nicht leer"; fi

echo "Rauchtest bestanden"
