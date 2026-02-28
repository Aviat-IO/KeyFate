## MODIFIED Requirements

### Requirement: Application Runtime

The system SHALL use SvelteKit 5 as the web framework with Bun as the JavaScript
runtime and package manager. The application SHALL be built with Svelte 5 runes
for reactivity and use Vite as the build tool. The system SHALL use adapter-node
(or adapter-bun) for production deployment.

#### Scenario: Production build with Bun

- **WHEN** the application is built for production
- **THEN** `bun run build` SHALL produce a deployable SvelteKit application
- **AND** the output SHALL be compatible with Docker container deployment

#### Scenario: Development server

- **WHEN** a developer runs `bun run dev`
- **THEN** a local development server SHALL start with hot module replacement
  via Vite

### Requirement: Container Build

The system SHALL use a multi-stage Docker build with `oven/bun:1` as the base
image. The container SHALL run database migrations on startup before serving the
application.

#### Scenario: Docker build and start

- **WHEN** the Docker container is built and started
- **THEN** Drizzle migrations SHALL run against the configured PostgreSQL
  database
- **AND** the SvelteKit application SHALL start serving on the configured port

### Requirement: CI/CD Pipeline

The system SHALL use GitHub Actions for continuous integration. The pipeline
SHALL install dependencies with Bun, run linting, type checking, and tests.

#### Scenario: CI runs on push

- **WHEN** code is pushed to main, develop, or staging branches
- **THEN** GitHub Actions SHALL run `bun install`, `bun run check`, and
  `bun run test`

### Requirement: Development Tooling

The system SHALL use Bun for all package management operations, replacing pnpm.
ESLint and Prettier SHALL be configured for Svelte files.

#### Scenario: Adding a dependency

- **WHEN** a developer needs to add a package
- **THEN** they SHALL use `bun add <package>` (not npm, pnpm, or yarn)
