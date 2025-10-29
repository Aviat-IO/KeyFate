# Policy Documents

This directory contains the source of truth for all legal policy documents
(Privacy Policy and Terms of Service).

## File Naming Convention

Files must follow this pattern:

```
{type}-{version}.md
```

Examples:

- `privacy-policy-1.0.0.md`
- `terms-of-service-1.0.0.md`
- `privacy-policy-1.1.0.md` (next version)

## Automated Sync

Policy documents are **automatically synced** to the database during the build
process.

The sync script (`scripts/sync-policy-documents.ts`) runs before every build
and:

1. Scans this directory for `.md` files
2. Parses the filename to extract type and version
3. Checks if the version already exists in the database
4. Inserts new versions only - **never updates existing ones**
5. Validates that existing versions haven't been modified (content hash check)

## Creating a New Version

When you need to update a policy:

### 1. Create a new file with incremented version

```bash
# Copy current version
cp privacy-policy-1.0.0.md privacy-policy-1.1.0.md

# Edit the new file
# Update the version number in the markdown header
# Update the effective date
# Make your changes
```

### 2. Update the header in the new file

```markdown
# Privacy Policy

**Effective Date:** March 1, 2025\
**Version:** 1.1.0
```

### 3. Sync to database

```bash
# Manually sync (requires database connection)
npm run sync-policies

# Or use the deploy command which syncs then builds
npm run deploy
```

### 4. Update the application constant

Edit `src/lib/auth/privacy-policy.ts`:

```typescript
export const CURRENT_PRIVACY_POLICY_VERSION = "1.1.0";
```

## Important Rules

### ❌ DO NOT modify existing policy files

Once a policy version is in the database, its content is immutable. This is
critical for:

- Legal compliance
- Audit trail integrity
- GDPR proof of consent

If you try to modify an existing file, the sync script will **fail the build**
with an error.

### ✅ DO create new versions

Always create a new version file when making changes, even for typos. This
maintains the legal audit trail.

### ✅ DO use semantic versioning

- **Major** (1.0.0 → 2.0.0): Breaking changes, significant policy shifts
- **Minor** (1.0.0 → 1.1.0): New sections, clarifications, non-breaking changes
- **Patch** (1.0.0 → 1.0.1): Typo fixes, formatting, no legal changes

## Manual Sync

If you need to manually sync without building:

```bash
npm run sync-policies
```

This is useful when:

- Testing the sync script
- Seeding a new database
- Verifying policy documents are correct

## Database Schema

Synced documents are stored in the `policy_documents` table:

- `id`: UUID primary key
- `type`: 'privacy_policy' | 'terms_of_service'
- `version`: Version string (e.g., "1.0.0")
- `content`: Full markdown content
- `effective_date`: When this version takes effect
- `created_at`: When synced to database

User acceptances are linked to specific document IDs in
`privacy_policy_acceptance`:

- `policy_document_id`: Links to privacy policy they accepted
- `terms_document_id`: Links to terms of service they accepted

This ensures we can always prove exactly what legal text a user agreed to.

## Troubleshooting

### Error: "Content changed for existing version"

You tried to modify an existing policy file. Create a new version instead.

### Error: "Policies directory not found"

The `policies/` directory doesn't exist. Make sure you're in the frontend
directory.

### Error: "No policy files found"

No `.md` files match the naming pattern. Check your filenames.

### Warning: "Skipping invalid filename"

A file doesn't match the `{type}-{version}.md` pattern. Rename it or delete it.
