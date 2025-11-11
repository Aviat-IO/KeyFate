FROM node:22-alpine AS base
RUN npm install -g pnpm

# Install dependencies
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile

# Build application
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Accept build arguments for Next.js build
ARG BUILD_ENV=production
ARG NEXTAUTH_URL
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_SUPPORT_EMAIL

# Set environment variables for build
ENV NEXTAUTH_URL=$NEXTAUTH_URL
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=$NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_SUPPORT_EMAIL=$NEXT_PUBLIC_SUPPORT_EMAIL

# Build without env validation (secrets are injected at runtime in Cloud Run)
# The validate-env.js script runs when the app starts (see package.json "start" script)
RUN pnpm build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

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

# Copy migration script, drizzle config, and migrations (from build context, not builder stage)
COPY --chown=nextjs:nodejs scripts/migrate-and-start.sh /app/scripts/migrate-and-start.sh
COPY --chown=nextjs:nodejs drizzle.config.ts /app/drizzle.config.ts
COPY --chown=nextjs:nodejs drizzle /app/drizzle

# Copy node_modules from builder for migration tools (drizzle-kit, postgres driver, etc.)
# We need the full node_modules because drizzle-kit has many dependencies
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules

# Ensure script is executable
USER root
RUN chmod +x /app/scripts/migrate-and-start.sh
USER nextjs

EXPOSE 3000

ENV PORT=3000
# The Next.js standalone server binds to :: (IPv6) / 0.0.0.0 (IPv4) by default
# We don't set HOSTNAME as it would interfere with OAuth callback URLs

# Use migration wrapper script as entrypoint
CMD ["sh", "/app/scripts/migrate-and-start.sh"]
