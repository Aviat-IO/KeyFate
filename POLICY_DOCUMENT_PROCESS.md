# Policy Document Revision Process

This document outlines the process for creating and managing revisions to legal
policy documents (Privacy Policy and Terms of Service).

## Overview

Policy documents are stored in `frontend/policies/` as versioned markdown files
and automatically synced to the database. The system enforces **immutability** -
once a version is in the database, its content cannot be changed. This ensures
legal integrity and compliance with GDPR requirements for proving informed
consent.

## File Structure

```
frontend/
├── policies/
│   ├── privacy-policy-1.0.0.md      # Current privacy policy
│   ├── terms-of-service-1.0.0.md    # Current terms of service
│   └── README.md                     # Detailed documentation
└── scripts/
    └── sync-policy-documents.ts      # Automated sync script
```

## Creating a New Policy Version

### Step 1: Create New Version File

Copy the current version and increment the version number:

```bash
cd frontend/policies

# For privacy policy updates
cp privacy-policy-1.0.0.md privacy-policy-1.1.0.md

# For terms of service updates
cp terms-of-service-1.0.0.md terms-of-service-1.1.0.md
```

### Step 2: Update the New File

Edit the new file and update:

1. **Version number** in the markdown header:

   ```markdown
   # Privacy Policy

   **Effective Date:** March 15, 2025 **Version:** 1.1.0
   ```

2. **Effective date** - When this version takes effect (typically 30+ days in
   future for material changes)

3. **Content changes** - Make your policy updates

### Step 3: Version Numbering

Use semantic versioning:

- **Major (1.0.0 → 2.0.0)**: Significant policy changes, breaking changes, major
  new sections
- **Minor (1.0.0 → 1.1.0)**: New sections, clarifications, non-breaking
  additions
- **Patch (1.0.0 → 1.0.1)**: Typo fixes, formatting, minor clarifications (no
  legal impact)

### Step 4: Sync to Database

The sync script connects to the appropriate database based on environment.

**For Local Development:**

```bash
cd frontend
npm run sync-policies  # Uses .env.local
```

**For Staging/Production:**

```bash
# Terminal 1: Start Cloud SQL Proxy
cd frontend
npm run db:proxy-staging  # or db:proxy-prod

# Terminal 2: Sync policies
cd frontend
npm run sync-policies:staging  # or sync-policies:prod
```

The script will:

- ✅ Detect the new version and insert it
- ✅ Verify existing versions haven't been modified
- ❌ Fail if you try to modify an existing version

### Step 5: Update Application Constant

Edit `frontend/src/lib/auth/privacy-policy.ts` to update the current version:

```typescript
export const CURRENT_PRIVACY_POLICY_VERSION = "1.1.0";
```

This tells the application which version new users should accept.

### Step 6: Test and Deploy

```bash
# Run tests
npm test

# Build application
npm run build

# Deploy to production
# (Policies must be synced separately via Cloud SQL Proxy)
```

## Existing User Migration

When you update to a new policy version:

### Option 1: Require Re-acceptance (Breaking Change)

If the changes are material (e.g., new data usage, changed rights):

1. Update `CURRENT_PRIVACY_POLICY_VERSION` as shown above
2. The `PrivacyPolicyGuard` component will detect users haven't accepted the new
   version
3. Users will see a modal requiring acceptance before they can use the app
4. Acceptance is recorded with links to the new policy documents

### Option 2: Grandfather Existing Users (Non-Breaking)

If the changes are minor (clarifications, formatting):

1. Insert the new version but don't update `CURRENT_PRIVACY_POLICY_VERSION`
2. New users get the latest version automatically
3. Existing users continue under their accepted version
4. Document the grandfathering decision in commit message

## Important Rules

### ❌ NEVER Modify Existing Files

Once a policy version file is synced to the database:

- **DO NOT** edit the content
- **DO NOT** change the filename
- **DO NOT** delete the file

The sync script validates content hashes and will **fail the build** if existing
content is modified.

### ✅ ALWAYS Create New Versions

Even for typos or formatting:

- Create a new version file
- Use patch version increment (1.0.0 → 1.0.1)
- Document the reason in git commit

This maintains the complete legal audit trail.

## Database Schema

Policy documents are stored in two tables:

**`policy_documents`**

- Stores the full markdown content of each version
- Immutable once created
- Indexed by (type, version)

**`privacy_policy_acceptance`**

- Records user acceptances
- Links to specific `policy_document_id` and `terms_document_id`
- Proves exactly what text a user agreed to

## Verification

To verify a policy is in the database:

```bash
# Connect to database
psql $DATABASE_URL

# Check policy versions
SELECT type, version, effective_date, created_at
FROM policy_documents
ORDER BY type, effective_date DESC;

# Check user acceptances
SELECT
  u.email,
  ppa.accepted_at,
  ppa.policy_version,
  pd_privacy.version as privacy_doc_version,
  pd_terms.version as terms_doc_version
FROM privacy_policy_acceptance ppa
JOIN users u ON ppa.user_id = u.id
JOIN policy_documents pd_privacy ON ppa.policy_document_id = pd_privacy.id
JOIN policy_documents pd_terms ON ppa.terms_document_id = pd_terms.id
ORDER BY ppa.accepted_at DESC
LIMIT 10;
```

## Legal Compliance

This system ensures:

✅ **GDPR Article 7**: Proof of informed consent with specific version\
✅ **GDPR Article 13-14**: Transparency about data processing\
✅ **Audit Trail**: Complete history for regulatory compliance\
✅ **Dispute Resolution**: Timestamped evidence for legal proceedings\
✅ **Version Control**: Clear tracking of all policy changes

## Troubleshooting

### Error: "Content changed for existing version"

**Problem:** You edited an existing policy file that's already in the database.

**Solution:**

1. Revert your changes:
   `git checkout -- frontend/policies/privacy-policy-1.0.0.md`
2. Create a new version instead:
   `cp privacy-policy-1.0.0.md privacy-policy-1.0.1.md`
3. Make your changes to the new file

### Error: "Policy documents not found in database"

**Problem:** The database doesn't have any policy documents yet.

**Solution:**

1. Ensure migration 0019 has been run: `npm run db:migrate`
2. Run the sync script: `npm run sync-policies`

### Warning: "Skipping invalid filename"

**Problem:** A markdown file doesn't match the naming pattern.

**Solution:** Rename the file to match: `{type}-{version}.md`

- Valid: `privacy-policy-1.2.0.md`
- Invalid: `privacy-policy.md`, `privacy_policy_1.2.0.md`

## Examples

### Example 1: Adding a New Data Processing Purpose

```bash
# Create new version
cp frontend/policies/privacy-policy-1.0.0.md frontend/policies/privacy-policy-1.1.0.md

# Edit privacy-policy-1.1.0.md:
# - Update version to 1.1.0
# - Set effective date 30 days in future
# - Add new section explaining the data processing purpose

# Start Cloud SQL Proxy
cloud-sql-proxy --port=54321 keyfate-dev:us-central1:keyfate-postgres-staging

# Sync to database
cd frontend && npm run sync-policies

# Update app constant
# Edit src/lib/auth/privacy-policy.ts:
# export const CURRENT_PRIVACY_POLICY_VERSION = "1.1.0"

# Commit
git add -A
git commit -m "feat: update privacy policy v1.1.0 - add analytics processing"

# Deploy application
npm run build
```

### Example 2: Fixing a Typo

```bash
# Create patch version
cp frontend/policies/terms-of-service-1.0.0.md frontend/policies/terms-of-service-1.0.1.md

# Edit terms-of-service-1.0.1.md:
# - Update version to 1.0.1
# - Fix the typo
# - Keep same effective date or set to today

# Start Cloud SQL Proxy
cloud-sql-proxy --port=54321 keyfate-dev:us-central1:keyfate-postgres-staging

# Sync to database
cd frontend && npm run sync-policies

# Update app constant (if requiring re-acceptance)
# Edit src/lib/auth/privacy-policy.ts:
# export const CURRENT_PRIVACY_POLICY_VERSION = "1.0.1"

# Commit
git add -A
git commit -m "fix: correct typo in terms of service v1.0.1"
```

## Related Files

- `frontend/policies/README.md` - Detailed technical documentation
- `frontend/scripts/sync-policy-documents.ts` - Sync script implementation
- `frontend/src/lib/auth/privacy-policy.ts` - Policy version constant and
  utilities
- `frontend/drizzle/0019_add_policy_documents.sql` - Database migration

## Questions?

For questions about policy document management:

- Review `frontend/policies/README.md` for technical details
- Check the sync script: `frontend/scripts/sync-policy-documents.ts`
- Review the database schema in `frontend/src/lib/db/schema.ts`
