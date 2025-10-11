# KeyFate Frontend

Next.js frontend for the KeyFate dead man's switch platform.

## Development

### Prerequisites

- Node.js 18+
- pnpm (recommended)
- Supabase CLI

### Quick Start

1. **Install dependencies:**

   ```bash
   pnpm install
   ```

2. **Start Supabase locally:**

   ```bash
   supabase start
   ```

3. **Run development server:**

   ```bash
   pnpm dev
   ```

4. **Open [http://localhost:3000](http://localhost:3000)** in your browser

### Environment Variables

Create `.env.local` for development:

```env
# App Configuration
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_COMPANY=KeyFate
NEXT_PUBLIC_SUPPORT_EMAIL=support@aviat.io

# Google OAuth (optional for local dev)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Local encryption key (generate with: openssl rand -base64 32)
ENCRYPTION_KEY=your-local-encryption-key
```

## Architecture

### Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS, Shadcn UI
- **Authentication:** Supabase Auth
- **Database:** Supabase (PostgreSQL)
- **Security:** Client-side Shamir's Secret Sharing

### Key Features

- **Dead Man's Switch:** Automated secret delivery when users fail to check in
- **Shamir's Secret Sharing:** Secrets split and encrypted entirely in browser
- **Google OAuth:** Seamless authentication
- **Responsive Design:** Mobile-first, modern UI

### Development Patterns

- Server components by default
- Use `'use client'` only for Web API access
- Functional components with TypeScript
- Named exports over default exports
- `nuqs` for URL search parameter state

## Building & Deployment

### Build

```bash
pnpm build
```

### Production Deployment

Production deployment is handled by Terragrunt. See [Infrastructure README](../infrastructure/README.md) for details.

### Manual Testing

```bash
# Run tests
pnpm test

# Type checking
pnpm type-check

# Linting
pnpm lint
```

## Project Structure

```none
src/
├── app/                 # Next.js App Router
│   ├── (authenticated)/ # Protected routes
│   ├── (main)/         # Public routes
│   └── api/            # API routes
├── components/         # Reusable components
│   ├── ui/            # Shadcn UI components
│   └── forms/         # Form components
├── lib/               # Utilities & configs
├── hooks/             # Custom React hooks
└── types/             # TypeScript types
```

## Key Components

- **Secret Management:** Create, edit, and manage secrets
- **Check-in System:** Automated reminders and status tracking
- **Contact Methods:** Email/SMS delivery configuration
- **Encryption:** Client-side SSS implementation
- **Authentication:** Supabase Auth integration

## Development Tips

- Use TypeScript strictly
- Follow Next.js App Router patterns
- Test with local Supabase instance
- Keep secrets client-side only
- Use Shadcn UI components for consistency
