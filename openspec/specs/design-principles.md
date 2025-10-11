# Design Principles

## General Principles

- **Security is paramount.** Users will be providing sensitive information and must be protected.
- **Testability.** All code should be testable and have a unit test.
- **Performance.** The app should be performant and efficient.
- **Scalability.** The app should be scalable and able to handle a large number of users.
- **Maintainability.** The app should be maintainable and easy to understand.
- **Multiple environments.** The app should be able to be deployed to multiple environments (dev, staging, production).

## UI

- Use TailwindCSS for styling.
- Use Shadcn/UI for components. Prompt the user to install any needed components.
- Theme configuration defined in `frontend/src/app/globals.css`

## Database

- Use PostgreSQL 16 (Cloud SQL for production, local Docker for development)
- Use Drizzle ORM for database access and migrations
- Leverage PostgreSQL features for advanced functionality
- Use DB migrations to manage the database schema (via Drizzle Kit)
- Private IP configuration for Cloud SQL in production

## Authentication

- Use NextAuth.js v4 for authentication
- Google OAuth as primary authentication provider
- Email verification required for users and recipients
- Session management via NextAuth.js

## API

- Use Next.js 15 App Router API routes
- RESTful patterns for API endpoints
- Server-side encryption/decryption operations
- Cron job authentication for automated tasks
