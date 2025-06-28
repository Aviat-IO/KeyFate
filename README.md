# KeyFate (Dead Man's Switch)

Your key to peace of mind.

A secure digital service that automatically triggers an alarm or other emergency response when the user is incapacitated.

A user is required to check in with the app at a regular interval to keep the switch from triggering. If they fail to check in by the secret's configured interval, the secret will be marked as triggered and the configured actions will be taken. This typically involves sending an SMS or email to a trusted contact.

## Tech Stack

- Next.js
- Deno v2
- Supabase
- Postgres
- Tailwind CSS
- Lucide Icons
- Shadcn UI

## Deployment

### Local development

```bash
supabase start
supabase functions serve process-reminders --env-file ./supabase/functions/.env.development.local
```

Testing the email function:

```bash
supabase functions serve --env-file ./supabase/functions/.env.development.local
```

Then run either:

```bash
./scripts/trigger-reminders.sh
```

or

```bash
curl -i http://127.0.0.1:54321/functions/v1/process-reminders
```

### Production deployment

```bash
supabase secrets set --env-file ./supabase/functions/.env.production.local
supabase functions deploy process-reminders --env-file ./supabase/functions/.env.production.local
supabase functions deploy check-secrets --env-file ./supabase/functions/.env.production.local
```

## TODO

- [ ] Add tests
- [x] Enable users to pause and reactivate secrets
- [x] Reminders to check in
- [x] ToS and Privacy Policy
- [x] New secret email
- [ ] SMS reminders
- [ ] Security audit
- [x] Fix Google Auth
- [ ] Email verification for user.meta.email_verified not being set to true. Also need to enable email verify with OTP.

Reminder email needs to handle more than 50 reminders.
