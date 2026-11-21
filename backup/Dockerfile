# Sicherung von Datenbank und Dateien (Kap. 18).
# Gleiche PostgreSQL-Version wie der Dienst db, damit pg_dump/pg_restore passen.
FROM postgres:17-alpine
LABEL org.opencontainers.image.source=https://github.com/extrempro/intranet \
	org.opencontainers.image.description="Sicherung für das Intranet" \
	org.opencontainers.image.licenses=MIT
RUN apk add --no-cache age rsync tzdata su-exec
ENV TZ=Europe/Berlin
COPY --chmod=755 sicherung.sh pruefung.sh zeitplan.sh wiederherstellen.sh /usr/local/bin/
ENTRYPOINT ["/usr/local/bin/zeitplan.sh"]
