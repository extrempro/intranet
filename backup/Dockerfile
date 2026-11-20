# Sicherung von Datenbank und Dateien (Kap. 18).
# Gleiche PostgreSQL-Version wie der Dienst db, damit pg_dump/pg_restore passen.
FROM postgres:17-alpine
RUN apk add --no-cache age rsync tzdata su-exec
ENV TZ=Europe/Berlin
COPY --chmod=755 sicherung.sh pruefung.sh zeitplan.sh wiederherstellen.sh /usr/local/bin/
ENTRYPOINT ["/usr/local/bin/zeitplan.sh"]
