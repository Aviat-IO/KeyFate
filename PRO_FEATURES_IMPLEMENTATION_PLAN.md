# Pro Features Implementation Plan

## Overview

This document outlines the implementation plan for four new Pro tier features. Each feature has been created as a separate OpenSpec proposal with complete specs, tasks, and validation.

## Features Added

### 1. Priority Support (support@aviat.io)
**Proposal:** `openspec/changes/add-priority-support/`

**Description:** Display dedicated support email to Pro users in pricing page, welcome modal, and Pro banner.

**Key Tasks:**
- Create centralized Pro features constant (`frontend/src/constants/pro-features.ts`)
- Update pricing page to show support email
- Create "Welcome to Pro!" modal component
- Update navbar Pro banner to trigger modal
- Write tests for modal and feature display

**Implementation Complexity:** Low (mostly UI updates)

### 2. Secret Message Templates (Pro Only)
**Proposal:** `openspec/changes/add-secret-message-templates/`

**Description:** Restrict existing 7 message templates to Pro tier only with server-side validation.

**Templates Available:**
1. Bitcoin Wallet Access
2. Password Manager Master Password
3. Estate Planning Documents
4. Safe Deposit Box Instructions
5. Cryptocurrency Exchange Account
6. Cloud Storage Access
7. Social Media Account Access

**Key Tasks:**
- Add tier check to message template selector component
- Create server-side middleware for template access validation
- Hide template UI for Free users with upgrade prompt
- Update pricing page to highlight templates
- Write tests for tier enforcement

**Implementation Complexity:** Low-Medium (validation + UI)

### 3. Configurable Threshold Schemes (2-of-N up to 7 shares)
**Proposal:** `openspec/changes/add-configurable-threshold-schemes/`

**Description:** Allow Pro users to configure Shamir's Secret Sharing threshold schemes beyond the standard 2-of-3. Free users locked to 2-of-3.

**Supported Configurations:**
- Free: 2-of-3 only (locked)
- Pro: Any combination where 2 ≤ threshold ≤ total_shares ≤ 7
  - Examples: 2-of-3, 3-of-5, 4-of-7, 5-of-7, etc.

**Key Tasks:**
- Create threshold validation utility
- Update secret creation/update APIs with tier validation
- Create ThresholdSelector UI component (Pro only)
- Update client-side Shamir implementation for variable shares
- Add threshold constants and feature to PRO_FEATURES
- Write comprehensive tests for all threshold schemes

**Implementation Complexity:** Medium-High (crypto + validation)

### 4. Comprehensive Audit Logs
**Proposal:** `openspec/changes/add-audit-logs/`

**Description:** Track all user and system activities in a dedicated audit_logs table. Pro users can view, filter, and export their logs.

**Events Logged:**
- Secret lifecycle (created, edited, deleted)
- Check-ins
- Recipient management (added, removed)
- Secret triggers
- Login/logout events
- Subscription changes
- Settings updates

**Key Tasks:**
- Create audit_logs database table and migration
- Create audit logging service/utility
- Add logging to all relevant endpoints
- Create API endpoints: GET /api/audit-logs, GET /api/audit-logs/export
- Create AuditLogsPage UI component with filters and pagination
- Add tier validation for audit log access
- Write tests for logging, retrieval, and export

**Implementation Complexity:** High (database + service + UI)

## Files Created

### OpenSpec Proposals
```
openspec/changes/
├── add-priority-support/
│   ├── proposal.md
│   ├── tasks.md
│   └── specs/pro-tier-features/spec.md
├── add-secret-message-templates/
│   ├── proposal.md
│   ├── tasks.md
│   └── specs/secret-message-templates/spec.md
├── add-configurable-threshold-schemes/
│   ├── proposal.md
│   ├── tasks.md
│   └── specs/shamir-threshold-configuration/spec.md
└── add-audit-logs/
    ├── proposal.md
    ├── tasks.md
    └── specs/audit-logging/spec.md
```

### New Constants File
```
frontend/src/constants/pro-features.ts
```

This file centralizes all Pro feature definitions with:
- `ProFeature` interface (id, title, description, features[])
- `PRO_FEATURES` array with all 5 features
- Helper functions: `getProFeatureById()`, `getProFeatureTitles()`, etc.
- `PRO_FEATURE_IDS` constant for easy reference

### Updated Files
```
openspec/project.md
```

Updated sections:
- Business Model: Added Pro feature details
- Security Model: Added threshold scheme details
- Business Constraints: Expanded Free/Pro tier limits

## Validation Status

All proposals validated successfully:
```bash
✅ openspec validate add-priority-support --strict
✅ openspec validate add-secret-message-templates --strict
✅ openspec validate add-configurable-threshold-schemes --strict
✅ openspec validate add-audit-logs --strict
```

## Implementation Order (Recommended)

1. **Priority Support** (Low complexity, foundational)
   - Creates PRO_FEATURES constant used by other features
   - Creates WelcomeToProModal used for onboarding

2. **Message Templates** (Low-Medium complexity)
   - Builds on PRO_FEATURES constant
   - Relatively isolated feature

3. **Configurable Threshold Schemes** (Medium-High complexity)
   - Requires crypto changes and thorough testing
   - Independent of other features

4. **Audit Logs** (High complexity)
   - Most complex feature with database + service + UI
   - Benefits from other features being complete for logging their events

## Testing Requirements

Each feature must have:
- ✅ Unit tests for business logic
- ✅ Integration tests for API endpoints
- ✅ Component tests for UI
- ✅ Tier enforcement tests (Free blocked, Pro allowed)
- ✅ E2E tests for critical paths (where applicable)

## Next Steps

1. Review and approve all four OpenSpec proposals
2. Implement features in recommended order
3. Update `frontend/src/constants/tiers.ts` to reference PRO_FEATURES
4. Update PricingPage.tsx to display new features
5. Create WelcomeToProModal component
6. Run full test suite after each feature
7. Deploy to staging for QA
8. Deploy to production
9. Archive proposals using `openspec archive <change-id>`

## Questions or Concerns?

Contact: support@aviat.io (when implemented!)
