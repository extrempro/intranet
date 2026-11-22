# Umwandlung der Videos für die Mediathek (Kap. 8.15): ffmpeg ohne Netz,
# schreibgeschützt, als Benutzer 1000 (wie die Anwendung, gemeinsamer Arbeitsordner).
FROM alpine:3.24
RUN apk add --no-cache ffmpeg \
	&& addgroup -g 1000 umwandlung \
	&& adduser -D -H -u 1000 -G umwandlung umwandlung \
	&& mkdir -p /arbeit && chown umwandlung:umwandlung /arbeit && chmod 700 /arbeit
COPY --chmod=0755 umwandeln.sh /usr/local/bin/umwandeln.sh
USER umwandlung
ENV ARBEIT=/arbeit
HEALTHCHECK --interval=60s --timeout=5s CMD test -w /arbeit
ENTRYPOINT ["/usr/local/bin/umwandeln.sh"]
