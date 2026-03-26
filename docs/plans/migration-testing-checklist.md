# Railway Migration & Feature Testing Checklist

Generated: 2026-03-26

## 1. Grant Admin Access

No users currently have `is_admin = true`. Run this against your Railway
PostgreSQL database:

```sql
-- Replace with your actual email
UPDATE users SET is_admin = true WHERE email = 'your-email@example.com';
```

Connect via Railway CLI:

```bash
railway connect postgres -e staging
# Then run the SQL above

railway connect postgres -e production
# Then run the SQL above
```

## 2. Fix DATABASE_URL Egress Warning

Your `DATABASE_URL` references the public TCP proxy domain. Switch to the
private network endpoint to avoid egress fees:

1. In Railway dashboard, go to your PostgreSQL plugin
2. Copy the **Private** connection string (uses `*.railway.internal`)
3. Update `DATABASE_URL` in your service variables to use the private endpoint
4. Redeploy

The private endpoint only works for services within the same Railway project.

## 3. Admin Dashboard Smoke Test

- [ ] Grant admin access (step 1 above)
- [ ] Log in to staging with admin account
- [ ] Navigate to `/admin` — verify dashboard renders
- [x] Verify API endpoint `GET /api/admin/metrics` returns JSON (bug fixed: Date
  serialization in email stats query)
- [ ] Verify non-admin gets 403 on `/admin`

## 4. Staging Verification

- [x] App builds successfully
- [x] All 495 tests pass
- [x] App deploys and starts on Railway
- [x] Database connectivity works
- [x] Auth login works
- [x] Health endpoints respond
- [x] Google OAuth callback URLs updated for staging
- [ ] Verify cron jobs execute on schedule — check logs:
  ```bash
  railway logs --service dead-mans-switch -e staging | grep scheduler
  ```
- [x] Stripe webhooks work (`stripe trigger payment_intent.succeeded` passed)
- [ ] ~~BTCPay webhooks~~ (paused — pricing page shows "Coming Soon")
- [ ] Verify SendGrid sender authentication for your domain
- [ ] Full smoke test: create secret, check in, trigger payment

## 5. Production Deploy

- [x] PostgreSQL plugin added to production
- [x] Deployed to production
- [x] Migrations ran
- [ ] Update DNS: point `keyfate.com` to Railway
  - In Railway dashboard → Settings → Domains → add `keyfate.com`
  - At your DNS provider: add CNAME record `keyfate.com` →
    `dead-mans-switch-production.up.railway.app`
  - Railway will auto-provision TLS
- [ ] Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client →
  Authorized redirect URIs → add `https://keyfate.com/auth/callback/google`
- [ ] Stripe dashboard → Developers → Webhooks → update endpoint URL to
  `https://keyfate.com/api/webhooks/stripe`
- [ ] ~~BTCPay webhook~~ (paused)
- [ ] End-to-end test on production: sign in, create secret, check in, payment

## 6. Database Backups

Requires Railway paid plan (Pro at $20/month). Includes:

- Daily automated snapshots
- Point-in-time recovery
- 7-day retention

## 7. GCP Teardown

**Only proceed after production on Railway is fully verified.**

Replace `PROJECT_ID` with your GCP project ID in all commands below. Run for
both staging and production projects if they're separate, or once if shared.

```bash
# Set your project
export PROJECT_ID="your-gcp-project-id"
gcloud config set project $PROJECT_ID
```

### 7.1 Disable and Delete Cloud Scheduler Jobs

```bash
# List all jobs
gcloud scheduler jobs list --location=us-central1

# Pause all jobs first (safe — reversible)
gcloud scheduler jobs pause check-secrets --location=us-central1
gcloud scheduler jobs pause process-reminders --location=us-central1
gcloud scheduler jobs pause confirm-utxos --location=us-central1

# Delete after confirming Railway cron works
gcloud scheduler jobs delete check-secrets --location=us-central1
gcloud scheduler jobs delete process-reminders --location=us-central1
gcloud scheduler jobs delete confirm-utxos --location=us-central1
```

- [ ] Cloud Scheduler jobs paused
- [ ] Cloud Scheduler jobs deleted

### 7.2 Delete Cloud Run Services

```bash
# List services
gcloud run services list

# Delete staging
gcloud run services delete dead-mans-switch --region=us-central1 --platform=managed

# If you have a separate production service
gcloud run services delete dead-mans-switch-production --region=us-central1 --platform=managed
```

- [ ] Cloud Run services deleted

### 7.3 Delete Cloud SQL Instances (DESTRUCTIVE)

**WARNING:** This permanently deletes all data. Only do this after confirming
Railway PostgreSQL has all your data.

```bash
# List instances
gcloud sql instances list

# Verify you have a recent backup if needed
gcloud sql backups list --instance=INSTANCE_NAME

# Delete (replace INSTANCE_NAME with actual name)
gcloud sql instances delete INSTANCE_NAME
```

- [ ] Verified Railway DB has all data
- [ ] Cloud SQL instance(s) deleted

### 7.4 Delete Bastion VMs

```bash
# List VMs
gcloud compute instances list

# Delete bastion(s)
gcloud compute instances delete bastion --zone=us-central1-a
```

- [ ] Bastion VMs deleted

### 7.5 Delete Artifact Registry Repositories

```bash
# List repos
gcloud artifacts repositories list --location=us-central1

# Delete
gcloud artifacts repositories delete REPO_NAME --location=us-central1
```

- [ ] Artifact Registry repositories deleted

### 7.6 Remove VPC and Networking

```bash
# Delete firewall rules first
gcloud compute firewall-rules list --filter="network=NETWORK_NAME"
gcloud compute firewall-rules delete RULE_NAME

# Delete VPC connector (if using Serverless VPC Access)
gcloud compute networks vpc-access connectors delete CONNECTOR_NAME --region=us-central1

# Delete subnets
gcloud compute networks subnets delete SUBNET_NAME --region=us-central1

# Delete VPC network
gcloud compute networks delete NETWORK_NAME
```

- [ ] Firewall rules deleted
- [ ] VPC connector deleted
- [ ] Subnets deleted
- [ ] VPC network deleted

### 7.7 Verify Billing

```bash
# Check remaining active resources
gcloud asset search-all-resources --scope=projects/$PROJECT_ID --format="table(assetType, name)"
```

- [ ] GCP billing console shows $0 projected spend
- [ ] No remaining active resources

## 8. New Feature Testing

### 8.1 Bitcoin Timelock Delivery

- [ ] Create a secret with a recipient who has a Nostr pubkey
- [ ] Enable Bitcoin delivery with a funded testnet UTXO (use a
      [testnet faucet](https://coinfaucet.eu/en/btc-testnet/))
- [ ] Verify timelock UTXO appears on mempool.space/testnet
- [ ] Check in (refresh) — old UTXO spent, new one created
- [ ] Verify cron confirms the UTXO (`/api/cron/confirm-utxos`)
- [ ] Recovery test: extract OP_RETURN data from pre-signed tx, verify K recovery

### 8.2 Nostr Encrypted Delivery

- [ ] Create a secret with recipients who have Nostr pubkeys (npub or hex)
- [ ] Publish shares — verify gift-wrapped events on relays
- [ ] Recovery: on `/recover`, choose Nostr method, enter nsec, search relays,
      unwrap to recover share

### 8.3 Passphrase Recovery

- [ ] Create a secret with Nostr delivery + passphrase
- [ ] On `/recover`, choose Passphrase method
- [ ] Enter passphrase + encrypted K bundle → verify share decrypts
- [ ] Accumulate 2+ shares → verify Shamir reconstruction works

### 8.4 Admin Dashboard

- [x] API endpoint created and tested (9 unit tests)
- [x] Date serialization bug fixed in email stats query
- [ ] Visual smoke test on staging after admin access granted
