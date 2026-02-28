## Why

The current GCP infrastructure (Cloud Run, Cloud SQL, Bastion, VPC, Cloud
Scheduler, Secret Manager, Artifact Registry) costs $100+/month across dev and
prod environments. The application has zero users. As the architecture moves
toward Nostr + Bitcoin where the server becomes a thin convenience layer, this
infrastructure is over-engineered and expensive. Railway Hobby at $5/month
provides Docker support, managed PostgreSQL, built-in cron, and zero ops burden.

## What Changes

- **BREAKING**: Remove all GCP Terraform/Terragrunt infrastructure
- **BREAKING**: Remove Cloud SQL, Cloud Run, Bastion host, VPC networking
- **BREAKING**: Remove Cloud Scheduler cron jobs (replaced by Railway cron or
  in-app scheduler)
- **BREAKING**: Remove Google Secret Manager (replaced by Railway environment
  variables or Doppler direct)
- **BREAKING**: Remove Cloud Build / Artifact Registry (Railway builds from
  Dockerfile or GitHub)
- Migrate to Railway Hobby plan ($5/month)
- Railway provides: Docker deployment, managed PostgreSQL, built-in cron,
  environment variables, deploy previews
- Secrets management via Railway environment variables (or keep Doppler and
  inject into Railway)

## Impact

- Affected specs: `infrastructure`
- Affected code: `infrastructure/` (entire directory removed or archived),
  `Makefile` (deploy targets), `.github/workflows/` (CI/CD), `scripts/` (deploy
  scripts)
- Non-affected: Application code (SvelteKit app deploys identically on Railway
  via Docker)
