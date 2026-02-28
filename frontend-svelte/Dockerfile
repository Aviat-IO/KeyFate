# Stage 1: Install dependencies
FROM oven/bun:1 AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Stage 2: Build
FROM oven/bun:1 AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun run build

# Stage 3: Production
FROM oven/bun:1-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy build output, dependencies, and migration files
COPY --from=builder /app/build ./build
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/drizzle.config.ts ./

# Copy and prepare startup script
COPY migrate-and-start.sh ./
RUN chmod +x migrate-and-start.sh

# Create exports directory for GDPR data exports
RUN mkdir -p /tmp/keyfate-exports

# Railway sets PORT dynamically; default to 3000
ENV PORT=3000
EXPOSE 3000

CMD ["./migrate-and-start.sh"]
