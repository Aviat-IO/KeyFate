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

### Prerequisites

Set up your environment variables:

```bash
# Development environment
export GOOGLE_PROJECT_ID_DEV="keyfate-dev"
export GOOGLE_PROJECT_ID_PROD="keyfate-prod"
export GOOGLE_REGION="us-central1"
export SUPABASE_PROJECT_ID_DEV="your-supabase-dev-project-id"
export SUPABASE_PROJECT_ID_PROD="your-supabase-prod-project-id"
```

### Google Cloud Setup

#### 1. Create Projects and Enable APIs

```bash
# Create projects (if they don't exist)
gcloud projects create $GOOGLE_PROJECT_ID_DEV --name="KeyFate Development"
gcloud projects create $GOOGLE_PROJECT_ID_PROD --name="KeyFate Production"

# Enable required APIs for development
gcloud services enable run.googleapis.com --project=$GOOGLE_PROJECT_ID_DEV
gcloud services enable cloudbuild.googleapis.com --project=$GOOGLE_PROJECT_ID_DEV
gcloud services enable storage.googleapis.com --project=$GOOGLE_PROJECT_ID_DEV

# Enable required APIs for production
gcloud services enable run.googleapis.com --project=$GOOGLE_PROJECT_ID_PROD
gcloud services enable cloudbuild.googleapis.com --project=$GOOGLE_PROJECT_ID_PROD
gcloud services enable storage.googleapis.com --project=$GOOGLE_PROJECT_ID_PROD
```

#### 2. Set up IAM Permissions

```bash
# Get project numbers
DEV_PROJECT_NUMBER=$(gcloud projects describe $GOOGLE_PROJECT_ID_DEV --format="value(projectNumber)")
PROD_PROJECT_NUMBER=$(gcloud projects describe $GOOGLE_PROJECT_ID_PROD --format="value(projectNumber)")

# Grant permissions for development
gcloud projects add-iam-policy-binding $GOOGLE_PROJECT_ID_DEV \
  --member="serviceAccount:${DEV_PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/cloudbuild.builds.builder"

gcloud projects add-iam-policy-binding $GOOGLE_PROJECT_ID_DEV \
  --member="serviceAccount:${DEV_PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/storage.objectViewer"

gcloud projects add-iam-policy-binding $GOOGLE_PROJECT_ID_DEV \
  --member="serviceAccount:${DEV_PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/logging.logWriter"

# Grant permissions for production
gcloud projects add-iam-policy-binding $GOOGLE_PROJECT_ID_PROD \
  --member="serviceAccount:${PROD_PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/cloudbuild.builds.builder"

gcloud projects add-iam-policy-binding $GOOGLE_PROJECT_ID_PROD \
  --member="serviceAccount:${PROD_PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/storage.objectViewer"

gcloud projects add-iam-policy-binding $GOOGLE_PROJECT_ID_PROD \
  --member="serviceAccount:${PROD_PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/logging.logWriter"
```

#### 3. Link Billing Accounts

```bash
# List available billing accounts
gcloud billing accounts list

# Link billing to projects (replace BILLING_ACCOUNT_ID with your actual billing account)
export BILLING_ACCOUNT_ID="your-billing-account-id"
gcloud billing projects link $GOOGLE_PROJECT_ID_DEV --billing-account=$BILLING_ACCOUNT_ID
gcloud billing projects link $GOOGLE_PROJECT_ID_PROD --billing-account=$BILLING_ACCOUNT_ID
```

### Supabase Deployment

#### 1. Install Supabase CLI

```bash
npm install -g supabase
```

#### 2. Development Environment

```bash
# Start local Supabase
supabase start

# Apply migrations
supabase db reset

# Deploy functions locally for testing
supabase functions serve process-reminders --env-file ./supabase/functions/.env.development.local
```

#### 3. Production Environment

```bash
# Link to your Supabase projects
supabase link --project-ref $SUPABASE_PROJECT_ID_DEV
supabase link --project-ref $SUPABASE_PROJECT_ID_PROD

# Push database schema to development
supabase db push --linked --project-ref $SUPABASE_PROJECT_ID_DEV

# Push database schema to production
supabase db push --linked --project-ref $SUPABASE_PROJECT_ID_PROD

# Deploy functions to development
supabase secrets set --env-file ./supabase/functions/.env.development.local --project-ref $SUPABASE_PROJECT_ID_DEV
supabase functions deploy process-reminders --project-ref $SUPABASE_PROJECT_ID_DEV
supabase functions deploy check-secrets --project-ref $SUPABASE_PROJECT_ID_DEV
supabase functions deploy send-email --project-ref $SUPABASE_PROJECT_ID_DEV
supabase functions deploy paddle-webhook --project-ref $SUPABASE_PROJECT_ID_DEV

# Deploy functions to production
supabase secrets set --env-file ./supabase/functions/.env.production.local --project-ref $SUPABASE_PROJECT_ID_PROD
supabase functions deploy process-reminders --project-ref $SUPABASE_PROJECT_ID_PROD
supabase functions deploy check-secrets --project-ref $SUPABASE_PROJECT_ID_PROD
supabase functions deploy send-email --project-ref $SUPABASE_PROJECT_ID_PROD
supabase functions deploy paddle-webhook --project-ref $SUPABASE_PROJECT_ID_PROD
```

### Google Cloud Run Deployment

#### 1. Frontend Application

```bash
# Navigate to frontend directory
cd frontend

# Deploy to development
make deploy-dev

# Deploy to production
make deploy-prod
```

#### 2. Configure Public Access (Optional)

If you want your Cloud Run service to be publicly accessible without authentication:

```bash
# Remove Domain Restricted Sharing Organization Policy (if it exists)
# This may require organization admin permissions
gcloud resource-manager org-policies delete constraints/iam.allowedPolicyMemberDomains --project=$GOOGLE_PROJECT_ID_DEV
gcloud resource-manager org-policies delete constraints/iam.allowedPolicyMemberDomains --project=$GOOGLE_PROJECT_ID_PROD

# Add public access to development service
gcloud beta run services add-iam-policy-binding \
  --region=$GOOGLE_REGION \
  --member=allUsers \
  --role=roles/run.invoker \
  keyfate \
  --project=$GOOGLE_PROJECT_ID_DEV

# Add public access to production service
gcloud beta run services add-iam-policy-binding \
  --region=$GOOGLE_REGION \
  --member=allUsers \
  --role=roles/run.invoker \
  keyfate \
  --project=$GOOGLE_PROJECT_ID_PROD
```

Note: If you cannot remove the organization policy, you can still provide access to specific users or domains:

```bash
# Grant access to specific user
gcloud beta run services add-iam-policy-binding \
  --region=$GOOGLE_REGION \
  --member=user:yourname@yourdomain.com \
  --role=roles/run.invoker \
  keyfate \
  --project=$GOOGLE_PROJECT_ID_DEV

# Grant access to entire domain
gcloud beta run services add-iam-policy-binding \
  --region=$GOOGLE_REGION \
  --member=domain:yourdomain.com \
  --role=roles/run.invoker \
  keyfate \
  --project=$GOOGLE_PROJECT_ID_DEV
```

#### 2. Manual Deployment (if Makefile fails)

```bash
# Development deployment
cd frontend
ENV_VARS=$(cat .env.development .env.development.local 2>/dev/null | grep -E '^[A-Z_][A-Z0-9_]*=' | tr '\n' ',' | sed 's/,$//')
gcloud run deploy keyfate \
  --source . \
  --platform managed \
  --region $GOOGLE_REGION \
  --allow-unauthenticated \
  --min-instances 0 \
  --cpu-boost \
  --project $GOOGLE_PROJECT_ID_DEV \
  $([ -n "$ENV_VARS" ] && echo "--set-env-vars=$ENV_VARS" || echo "")

# Production deployment
ENV_VARS=$(cat .env.production .env.production.local 2>/dev/null | grep -E '^[A-Z_][A-Z0-9_]*=' | tr '\n' ',' | sed 's/,$//')
gcloud run deploy keyfate \
  --source . \
  --platform managed \
  --region $GOOGLE_REGION \
  --allow-unauthenticated \
  --min-instances 0 \
  --cpu-boost \
  --project $GOOGLE_PROJECT_ID_PROD \
  $([ -n "$ENV_VARS" ] && echo "--set-env-vars=$ENV_VARS" || echo "")
```

### Environment Variables Setup

Create the following environment files:

#### Frontend Development (`.env.development.local`)

```env
NEXT_PUBLIC_SUPABASE_URL=your-dev-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-dev-supabase-anon-key
PADDLE_ENVIRONMENT=sandbox
PADDLE_CLIENT_TOKEN=your-dev-paddle-token
```

#### Frontend Production (`.env.production.local`)

```env
NEXT_PUBLIC_SUPABASE_URL=your-prod-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-prod-supabase-anon-key
PADDLE_ENVIRONMENT=production
PADDLE_CLIENT_TOKEN=your-prod-paddle-token
```

#### Supabase Functions Development (`.env.development.local`)

```env
SUPABASE_SERVICE_ROLE_KEY=your-dev-service-role-key
RESEND_API_KEY=your-resend-api-key
PADDLE_WEBHOOK_SECRET=your-dev-paddle-webhook-secret
```

#### Supabase Functions Production (`.env.production.local`)

```env
SUPABASE_SERVICE_ROLE_KEY=your-prod-service-role-key
RESEND_API_KEY=your-resend-api-key
PADDLE_WEBHOOK_SECRET=your-prod-paddle-webhook-secret
```

### Local Development

```bash
# Start Supabase locally
supabase start

# Run development server
cd frontend
pnpm dev

# Test functions locally
supabase functions serve --env-file ./supabase/functions/.env.development.local

# Test email function
curl -i http://127.0.0.1:54321/functions/v1/process-reminders
# or
./scripts/trigger-reminders.sh
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
