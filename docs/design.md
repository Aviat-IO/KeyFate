# Design

## General Principles

- Security is paramount. Users will be providing sensitive information and must be protected.
- Testability. All code should be testable and have a unit test.
- Performance. The app should be performant and efficient.
- Scalability. The app should be scalable and able to handle a large number of users.
- Maintainability. The app should be maintainable and easy to understand.
- Multiple environments. The app should be able to be deployed to multiple environments (dev, staging, production).

## UI

- Use TailwindCSS for styling.
- Use Shadcn/UI for components. Prompt the user to install any needed components.

## Database

- Use Supabase (postgres) for the database.
- Use Supabase Storage for file storage.
- Leverage postgres for cron jobs.
- Use DB migrations to manage the database schema.

## Authentication

- Use Supabase Auth for authentication.
- Use Supabase Auth to create a user and sign in with Google.

## API

- Use Supabase Functions for the API.
- Use Supabase Edge Functions for the API.
