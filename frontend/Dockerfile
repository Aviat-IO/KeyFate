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

# Accept NEXT_PUBLIC_ variables as build arguments for staging/dev
ARG NEXT_PUBLIC_COMPANY
ARG NEXT_PUBLIC_ENV
ARG NEXT_PUBLIC_PARENT_COMPANY
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_SUPPORT_EMAIL
ARG NEXT_PUBLIC_AUTH_PROVIDER
ARG NEXT_PUBLIC_DATABASE_PROVIDER
ARG NEXT_PUBLIC_BTCPAY_SERVER_URL

# Create .env.staging file if BUILD_ENV is staging and it doesn't exist
RUN if [ "$BUILD_ENV" = "staging" ] && [ ! -f .env.staging ]; then \
  echo "Creating .env.staging from build arguments"; \
  echo "NEXT_PUBLIC_COMPANY=\"KeyFate\"" > .env.staging; \
  echo "NEXT_PUBLIC_ENV=staging" >> .env.staging; \
  echo "NEXT_PUBLIC_PARENT_COMPANY=\"Aviat, LLC\"" >> .env.staging; \
  echo "NEXT_PUBLIC_SITE_URL=https://staging.keyfate.com" >> .env.staging; \
  echo "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_51RrR62RanDIU40YVFMjG7D718fANj5qHzMJJ2joRw1xa4Y8bGQ3TWflUVQ6mIt0HuuMPf2asZ6jhSV0VpeQWM0Eg00xJlCr8IX" >> .env.staging; \
  echo "NEXT_PUBLIC_SUPPORT_EMAIL=support@aviat.io" >> .env.staging; \
  echo "NEXT_PUBLIC_AUTH_PROVIDER=google" >> .env.staging; \
  echo "NEXT_PUBLIC_DATABASE_PROVIDER=cloudsql" >> .env.staging; \
  echo "NEXT_PUBLIC_BTCPAY_SERVER_URL=https://btcpay.keyfate.com" >> .env.staging; \
  echo "" >> .env.staging; \
  echo "# Dummy values for build-time requirements" >> .env.staging; \
  echo "NEXTAUTH_URL=https://staging.keyfate.com" >> .env.staging; \
  echo 'NEXTAUTH_SECRET="dummy-secret-for-build"' >> .env.staging; \
  echo 'DATABASE_URL="postgresql://dummy@localhost/dummy"' >> .env.staging; \
  echo 'GOOGLE_CLIENT_ID="dummy-client-id-for-build"' >> .env.staging; \
  echo 'GOOGLE_CLIENT_SECRET="dummy-client-secret-for-build"' >> .env.staging; \
  echo 'ENCRYPTION_KEY="dummy-encryption-key-for-build"' >> .env.staging; \
  echo 'STRIPE_SECRET_KEY="sk_test_dummy"' >> .env.staging; \
  fi

# Copy appropriate environment files based on BUILD_ENV
# Note: .local files won't exist in the build context (git-ignored)
# Next.js will automatically load .env.production during build
RUN if [ "$BUILD_ENV" = "staging" ]; then \
  echo "Building for staging environment"; \
  if [ -f .env.staging ]; then \
    cp .env.staging .env.production; \
    echo "Copied .env.staging to .env.production"; \
    cp .env.staging .env; \
    echo "Also copied .env.staging to .env for build compatibility"; \
  fi; \
  elif [ "$BUILD_ENV" = "production" ]; then \
  echo "Building for production environment"; \
  if [ -f .env.production ]; then \
    echo "Using .env.production"; \
    cp .env.production .env; \
    echo "Also copied .env.production to .env for build compatibility"; \
  fi; \
  else \
  echo "Building for development environment"; \
  if [ -f .env.development ]; then \
    cp .env.development .env.production; \
    echo "Copied .env.development to .env.production"; \
    cp .env.development .env; \
    echo "Also copied .env.development to .env for build compatibility"; \
  fi; \
  fi

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
