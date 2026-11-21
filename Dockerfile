# --- Bauen ---
FROM node:26-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi
COPY . .
RUN npm run build && npm prune --omit=dev

# --- Laufen ---
FROM node:26-alpine
LABEL org.opencontainers.image.source=https://github.com/extrempro/intranet \
	org.opencontainers.image.description="Intranet" \
	org.opencontainers.image.licenses=MIT
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /app/build ./build
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/package.json ./package.json
# Migrationen, werden beim Start eingespielt (src/hooks.server.ts)
COPY --from=build --chown=node:node /app/drizzle ./drizzle
# Notfallzugang: docker compose exec app node scripts/notfall-admin.mjs
COPY --from=build --chown=node:node /app/scripts/notfall-admin.mjs ./scripts/notfall-admin.mjs
# Ablage für verschlüsselte Dateien (Volume in docker-compose.yml)
RUN mkdir -p /data/files && chown node:node /data/files && chmod 700 /data/files
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
	CMD wget -qO- http://127.0.0.1:3000/health || exit 1
CMD ["node", "build"]
