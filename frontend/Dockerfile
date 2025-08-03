FROM node:22-alpine AS base

# Install pnpm
RUN npm install -g pnpm

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy package.json and lock file
COPY package.json pnpm-lock.yaml* ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Accept build argument for environment
ARG BUILD_ENV=production

# Copy appropriate environment files based on BUILD_ENV
RUN if [ "$BUILD_ENV" = "staging" ]; then \
      echo "Building for staging environment"; \
      cp .env.staging .env.production 2>/dev/null || true; \
      cp .env.staging.local .env.production.local 2>/dev/null || true; \
    elif [ "$BUILD_ENV" = "development" ]; then \
      echo "Building for development environment"; \
      cp .env.development .env.production 2>/dev/null || true; \
      cp .env.development.local .env.production.local 2>/dev/null || true; \
    else \
      echo "Building for production environment"; \
    fi

# Build the app
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
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
