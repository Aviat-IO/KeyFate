FROM node:22-alpine AS base

# Install pnpm
RUN npm install -g pnpm

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy package.json and lock file
COPY package.json pnpm-lock.yaml* ./

# Install dependencies with lockfile regeneration if needed
RUN pnpm install --no-frozen-lockfile || pnpm install

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Accept build argument for environment
# This determines which .env files to use
ARG BUILD_ENV=production

# Note: We don't need to copy .env files anymore since we're using runtime configuration
# Environment variables will be injected at runtime by Cloud Run from Secret Manager

# Debug: Show what environment files exist
RUN ls -la .env* || true

# Debug: Show the content of .env files (without secrets)
RUN if [ -f .env ]; then \
    echo "=== .env file content (NEXT_PUBLIC vars only) ==="; \
    grep "^NEXT_PUBLIC_" .env || echo "No NEXT_PUBLIC_ variables found"; \
  fi

# Build the app with environment variables loaded
# Next.js will load .env and .env.production files during build
RUN pnpm build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy the public folder
COPY --from=builder /app/public ./public

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Copy the build output
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
# The Next.js standalone server binds to :: (IPv6) / 0.0.0.0 (IPv4) by default
# We don't set HOSTNAME as it would interfere with OAuth callback URLs

# Start the standalone server
CMD ["node", "server.js"]
