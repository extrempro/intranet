#!/usr/bin/env bash
# Startet die Anwendung für die Browser-Tests mit der echten docker-compose.yml
# (Images selbst gebaut) und spielt die Testdaten aus e2e/seed.sql ein.
#   bash e2e/start.sh        starten (Adresse: http://localhost:3999)
#   bash e2e/start.sh logs   Logs der Anwendung
#   bash e2e/start.sh stop   stoppen und alle Daten löschen
set -euo pipefail
cd "$(dirname "$0")/.."

export COMPOSE_PROJECT_NAME=intranet-e2e
ENV=.env.e2e
dc() { docker compose -f docker-compose.yml -f docker-compose.build.yml --env-file "$ENV" "$@"; }

case "${1:-start}" in
logs)
	dc logs --no-color --tail=200 app db
	exit 0
	;;
stop)
	dc down -v --remove-orphans >/dev/null 2>&1 || true
	rm -f "$ENV"
	exit 0
	;;
esac

cat >"$ENV" <<ENVDATEI
POSTGRES_USER=intranet
POSTGRES_PASSWORD=e2e-$(openssl rand -hex 12)
POSTGRES_DB=intranet
APP_DATABASE_PASSWORD=e2e-app-$(openssl rand -hex 12)
ENCRYPTION_KEY=$(openssl rand -base64 32)
ORIGIN=http://localhost:3999
APP_BIND=127.0.0.1
APP_PORT=3999
ENVDATEI

echo "== Images bauen"
dc build --quiet app
echo "== Datenbank und Anwendung starten"
dc up -d --wait --wait-timeout 180 db app
echo "== Testdaten einspielen"
# In einer Transaktion; falls die Migrationen noch laufen, kurz warten und neu versuchen
for versuch in $(seq 1 10); do
	dc exec -T db psql -X -q -1 -v ON_ERROR_STOP=1 -U intranet -d intranet <e2e/seed.sql && break
	[ "$versuch" -eq 10 ] && exit 1
	sleep 3
done
curl -fsS http://localhost:3999/health >/dev/null
echo "== bereit: http://localhost:3999"
