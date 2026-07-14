# Bun version and OCI digests are pinned together; update deliberately with CI evidence.
FROM oven/bun:1.3.14@sha256:e10577f0db68676a7024391c6e5cb4b879ebd17188ab750cf10024a6d700e5c4 AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM oven/bun:1.3.14@sha256:e10577f0db68676a7024391c6e5cb4b879ebd17188ab750cf10024a6d700e5c4 AS prod-deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production --omit peer

FROM oven/bun:1.3.14@sha256:e10577f0db68676a7024391c6e5cb4b879ebd17188ab750cf10024a6d700e5c4 AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun run build

FROM oven/bun:1.3.14-slim@sha256:d56a2534ffd262e92c12fd3249d3924d296d97086da773f821d7d0477435ea04 AS runner
WORKDIR /app
ENV NODE_ENV=production

# Railway exposes Git deployment variables at build time when declared as ARG.
ARG RAILWAY_GIT_COMMIT_SHA=unknown
LABEL org.opencontainers.image.source="https://github.com/Aviat-IO/KeyFate" \
      org.opencontainers.image.revision="$RAILWAY_GIT_COMMIT_SHA"

RUN groupadd --system --gid 1001 keyfate && \
    useradd --system --uid 1001 --gid keyfate --no-create-home keyfate

COPY --chown=keyfate:keyfate --from=builder /app/build ./build
COPY --chown=keyfate:keyfate --from=prod-deps /app/node_modules ./node_modules
COPY --chown=keyfate:keyfate --from=builder /app/package.json ./
COPY --chown=keyfate:keyfate --from=builder /app/drizzle ./drizzle
COPY --chown=keyfate:keyfate --from=builder /app/scripts/migrate.ts ./scripts/migrate.ts
COPY --chown=keyfate:keyfate --from=builder /app/src/lib/db/connection-policy.ts ./src/lib/db/connection-policy.ts

USER keyfate

ENV PORT=3000
EXPOSE 3000

# Railway runs `bun run db:migrate:production` as its pre-deploy command.
CMD ["bun", "run", "build/index.js"]
