# KeyFate (Dead Man's Switch)

A secure digital service that automatically triggers an alarm or other emergency response when the user is incapacitated.

## Quick Start

1. **Deploy Infrastructure:** See [Infrastructure README](infrastructure/README.md) for automated Terragrunt deployment
2. **Frontend Development:** See [Frontend README](frontend/README.md) for local development setup
3. **Supabase Setup:** Deploy database and functions with `supabase deploy`

## Tech Stack

- **Frontend:** Next.js, TypeScript, Tailwind CSS, Shadcn UI
- **Backend:** Supabase (Postgres, Auth, Edge Functions)
- **Infrastructure:** Google Cloud Run, Terraform, Terragrunt
- **Security:** Client-side Shamir's Secret Sharing, Secret Manager

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
- [ ] Email verification for user.meta.email_verified not being set to true. Also need to enable email verify with OTP.
- [ ] [SMTP set up](https://supabase.com/dashboard/project/kvutysvqnqvcqjhduqpd/auth/templates)
- [ ] [Update URL configuration](https://supabase.com/dashboard/project/kvutysvqnqvcqjhduqpd/auth/url-configuration)

Reminder email needs to handle more than 50 reminders.
