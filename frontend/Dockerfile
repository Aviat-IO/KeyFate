# Use specific version for reproducibility
FROM node:22-alpine AS base

# Install pnpm globally with specific version for consistency
RUN npm install -g pnpm@9

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy only package files first (better caching)
COPY package.json pnpm-lock.yaml* ./

# Install dependencies with frozen lockfile for reproducibility
# Use cache mount for pnpm store to speed up installs
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source code and build files
# Order matters: less frequently changing files first
COPY public ./public
COPY src ./src
COPY *.json *.ts *.js *.mjs ./
COPY .env* ./

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

# Build the app with build cache for Next.js
RUN --mount=type=cache,id=nextjs,target=/app/.next/cache \
    pnpm build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Create user/group in one layer
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

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
