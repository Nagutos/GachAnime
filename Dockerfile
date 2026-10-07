# syntax=docker/dockerfile:1
# One Dockerfile, several targets: api, tools (worker + migrations + CLI), web (Caddy + SPA).

FROM node:24-alpine AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/worker/package.json apps/worker/
COPY packages/config/package.json packages/config/
COPY packages/core/package.json packages/core/
COPY packages/db/package.json packages/db/
COPY packages/game/package.json packages/game/
COPY packages/importer/package.json packages/importer/
COPY packages/shared/package.json packages/shared/
COPY e2e/package.json e2e/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

FROM deps AS source
COPY . .

# ---- API: Next.js standalone server ----
FROM source AS api-build
RUN pnpm --filter @gachanime/api build

FROM node:24-alpine AS api
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=api-build --chown=node:node /app/apps/api/.next/standalone ./
# Owned by node so that the named `uploads` volume mounted here is writable.
RUN mkdir -p /app/uploads && chown node:node /app/uploads
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s \
  CMD wget -qO- http://127.0.0.1:3000/api/v1/health || exit 1
CMD ["node", "apps/api/server.js"]

# ---- Tools: worker, migrations, admin CLI (TypeScript run through tsx) ----
FROM source AS tools
ENV NODE_ENV=production
RUN mkdir -p /app/uploads && chown node:node /app/uploads
USER node
# tsx is resolved from each package, so commands run from the package directory.
WORKDIR /app/apps/worker
CMD ["node", "--import", "tsx", "src/main.ts"]

# ---- Web: static SPA served by Caddy, which also proxies /api ----
FROM source AS web-build
RUN pnpm --filter @gachanime/web build

FROM caddy:2-alpine AS web
COPY docker/Caddyfile /etc/caddy/Caddyfile
COPY --from=web-build /app/apps/web/dist /srv
