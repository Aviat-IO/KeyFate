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
ARG BUILD_ENV=production

# Build args for Next.js environment variables needed at build time
# These are passed from Terraform/Terragrunt
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_COMPANY
ARG NEXT_PUBLIC_PARENT_COMPANY
ARG NEXT_PUBLIC_SUPPORT_EMAIL
ARG NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_AUTH_PROVIDER
ARG NEXT_PUBLIC_DATABASE_PROVIDER
ARG NEXT_PUBLIC_ENV

# Set environment variables for the build
ENV NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL}
ENV NEXT_PUBLIC_COMPANY=${NEXT_PUBLIC_COMPANY}
ENV NEXT_PUBLIC_PARENT_COMPANY=${NEXT_PUBLIC_PARENT_COMPANY}
ENV NEXT_PUBLIC_SUPPORT_EMAIL=${NEXT_PUBLIC_SUPPORT_EMAIL}
ENV NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=${NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY}
ENV NEXT_PUBLIC_AUTH_PROVIDER=${NEXT_PUBLIC_AUTH_PROVIDER}
ENV NEXT_PUBLIC_DATABASE_PROVIDER=${NEXT_PUBLIC_DATABASE_PROVIDER}
ENV NEXT_PUBLIC_ENV=${NEXT_PUBLIC_ENV}

# Copy appropriate environment files based on BUILD_ENV (for any additional vars)
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

# Build the app (TypeScript errors are ignored via next.config.ts)
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
