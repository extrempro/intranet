# Sicherung von Datenbank und Dateien (Kap. 18).
# Gleiche PostgreSQL-Version wie der Dienst db, damit pg_dump/pg_restore passen.
FROM postgres:17-alpine
LABEL org.opencontainers.image.source=https://github.com/extrempro/intranet \
	org.opencontainers.image.description="Sicherung für das Intranet" \
	org.opencontainers.image.licenses=MIT
# apk upgrade: Sicherheitskorrekturen von Alpine, auch wenn das Basis-Image noch älter ist.
# gosu (aus dem Postgres-Image) wird nicht gebraucht, der Wiederherstellungstest nutzt
# su-exec; entfernt, weil es mit veralteter Go-Version gebaut ist (Trivy-Funde).
RUN apk upgrade --no-cache && apk add --no-cache age rsync tzdata su-exec && rm -f /usr/local/bin/gosu
ENV TZ=Europe/Berlin
COPY --chmod=755 sicherung.sh pruefung.sh zeitplan.sh wiederherstellen.sh /usr/local/bin/
# nosemgrep: dockerfile.security.missing-user-entrypoint.missing-user-entrypoint -- läuft bewusst als root, Begründung in .trivyignore.yaml
ENTRYPOINT ["/usr/local/bin/zeitplan.sh"]
