# KeyFate (Dead Man's Switch)

A secure digital service that automatically triggers an alarm or other emergency response when the user is incapacitated.

## 🚀 Quick Start (Local Development)

**Complete local development environment** with PostgreSQL and Docker:

```bash
# 1. Set up local environment
make install

# 2. Start development stack
make dev

# 3. Open application
open http://localhost:3000
```

**Development credentials:**
- dev@localhost / password123 (Free tier)
- test@localhost / password123 (Pro tier)

For detailed setup instructions, see [INFRASTRUCTURE.md](./INFRASTRUCTURE.md)

## Alternative Setup Options

1. **Deploy Infrastructure:** See [Infrastructure README](infrastructure/README.md) for automated Terragrunt deployment
2. **Frontend Development:** See [Frontend README](frontend/README.md) for local development setup

## Tech Stack

### Local Development
- **Frontend:** Next.js, TypeScript, Tailwind CSS, Shadcn UI
- **Database:** PostgreSQL 16 (Docker)
- **ORM:** Drizzle ORM
- **Orchestration:** Docker Compose, Make
- **Caching:** Redis 7 (optional)

### Production Options
- **Infrastructure:** Google Cloud Run, Terraform, Terragrunt
- **Database:** Google Cloud SQL (PostgreSQL)
- **Security:** Client-side Shamir's Secret Sharing, Secret Manager

## Database Connection

For production environments, the application connects to Google Cloud SQL PostgreSQL instances with SSL encryption enabled by default. Local development uses Docker PostgreSQL containers.

## TODO

- [x] Add tests
- [x] Enable users to pause and reactivate secrets
- [x] Reminders to check in
- [x] ToS and Privacy Policy
- [x] New secret email
- [ ] SMS reminders
- [ ] Security audit
- [ ] Fix Google Auth
- [ ] Deploy to staging and prod
- [ ] Test crons are working
- [ ] Email verification implementation for new user registrations
- [ ] SMTP configuration for production email delivery
- [ ] URL configuration for production deployment

Reminder email needs to handle more than 50 reminders.
