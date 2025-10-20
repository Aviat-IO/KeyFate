# Tier Enforcement Audit

## ADDED Requirements

### Requirement: Document all tier feature gaps between PRD and implementation

The audit SHALL provide comprehensive documentation identifying every gap between the business model defined in the PRD and the actual implementation in the codebase, enabling informed decision-making for remediation.

#### Scenario: Auditing secret creation limit enforcement

**GIVEN** the PRD specifies free tier users are limited to 1 secret and pro tier to 10 secrets  
**WHEN** reviewing the secret creation API endpoint at `frontend/src/app/api/secrets/route.ts`  
**THEN** the audit must document:
- Whether tier checking is implemented (result: NOT implemented)
- The specific code location where enforcement should occur (result: POST handler in route.ts)
- The existence of helper functions that should be called (result: `canUserCreateSecret` exists but returns hardcoded `true`)
- The security impact of missing enforcement (result: free users can create unlimited secrets)

#### Scenario: Auditing interval restriction enforcement

**GIVEN** the PRD specifies free tier allows only "1 week, 1 month, 1 year" intervals  
**WHEN** reviewing the secret creation form at `frontend/src/components/forms/newSecretForm.tsx`  
**THEN** the audit must document:
- The actual intervals shown in the UI (result: 7 options including daily, 2 weeks, 3 months, 6 months)
- Whether backend validation exists (result: no API validation found)
- Discrepancies between PRD, UI, and library code (result: UI shows 7, library defines 3, PRD specifies 3)
- Whether `isIntervalAllowed()` is called in API routes (result: not called)

#### Scenario: Auditing recipient limit enforcement

**GIVEN** the PRD specifies free tier allows 1 recipient per secret and pro tier allows 5  
**WHEN** reviewing the current implementation  
**THEN** the audit must document:
- Current UI support for multiple recipients (result: single recipient only in form)
- API validation for recipient count (result: none exists)
- Readiness for future multi-recipient feature (result: limits defined but not enforced)

#### Scenario: Auditing message template feature availability

**GIVEN** the PRD specifies message templates as a pro tier exclusive feature  
**WHEN** searching the codebase for template functionality  
**THEN** the audit must document:
- Whether user-facing template UI exists (result: does not exist)
- Whether template storage exists (result: no user template tables)
- Whether email templates are confused with message templates (result: email template system exists for transactional emails, but not user message templates)
- Feature implementation status (result: completely absent)

#### Scenario: Auditing usage tracking functionality

**GIVEN** tier limits can only be enforced with accurate usage counts  
**WHEN** reviewing usage calculation functions in `frontend/src/lib/subscription.ts`  
**THEN** the audit must document:
- Whether `calculateUserUsage()` returns real data (result: returns hardcoded `{ secrets_count: 0, total_recipients: 0 }`)
- Whether `getUserTierInfo()` queries the database (result: returns stub data)
- Impact on enforcement capability (result: limits cannot be enforced without accurate counts)
- Database schema readiness (result: tables exist but not utilized)

### Requirement: Identify security implications of missing tier enforcement

The audit SHALL evaluate and document the security and business risks created by gaps in tier enforcement, with severity ratings and attack vectors.

#### Scenario: Documenting tier bypass vulnerability

**GIVEN** the UI conditionally renders form fields based on `isPaid` prop  
**WHEN** the API endpoints lack corresponding tier validation  
**THEN** the audit must document:
- The attack vector (result: direct API calls bypassing UI)
- Risk severity level (result: HIGH)
- Exploitation steps (result: 1. Find API endpoints, 2. POST with forbidden values, 3. Bypass limits)
- Required mitigations (result: server-side validation on all endpoints, 403 responses for violations)

#### Scenario: Documenting revenue loss risk

**GIVEN** free tier users can access pro features without paying  
**WHEN** limits are not enforced  
**THEN** the audit must document:
- Which paid features are accessible to free users (result: unlimited secrets, custom intervals)
- Estimated business impact (result: zero conversion incentive)
- Priority level for remediation (result: P0 - immediate)

### Requirement: Provide prioritized remediation recommendations

The audit SHALL organize findings into actionable remediation tasks with clear priorities, enabling phased implementation.

#### Scenario: Categorizing fixes by priority

**GIVEN** multiple gaps are identified across different features  
**WHEN** creating remediation recommendations  
**THEN** the audit must:
- Assign priority levels (P0, P1, P2, P3)
- Group related fixes together
- Provide specific implementation locations
- Estimate implementation effort
- Identify dependencies between fixes

#### Scenario: Recommending P0 immediate fixes

**GIVEN** critical revenue and security issues exist  
**WHEN** prioritizing remediation work  
**THEN** the audit must identify as P0:
- Implementing `getUserTierInfo()` with real database queries
- Implementing `calculateUserUsage()` with actual counting
- Adding tier validation to secret creation endpoint
- Adding interval validation to secret creation endpoint

### Requirement: Document discrepancies requiring business decisions

The audit SHALL surface inconsistencies that require stakeholder input before technical implementation can proceed.

#### Scenario: Identifying free tier interval options conflict

**GIVEN** the PRD specifies 3 intervals but the UI shows 7  
**WHEN** documenting the discrepancy  
**THEN** the audit must:
- Present both Option A (strict 3 intervals) and Option B (generous 7 intervals)
- Provide a recommendation with reasoning (result: Option A for clear tier differentiation)
- Flag as requiring business approval before implementation
- Document impact of each option on user experience and conversion

#### Scenario: Identifying downgrade handling gap

**GIVEN** the system allows users to downgrade from Pro to Free  
**WHEN** a Pro user with 10 secrets downgrades  
**THEN** the audit must:
- Present options (force deletion, grandfather, grace period)
- Recommend approach (30-day grace period)
- Highlight user experience implications
- Flag as requiring product decision

### Requirement: Reference all evidence with code locations

The audit SHALL provide verifiable evidence for every finding by citing specific file paths, line numbers, and code snippets.

#### Scenario: Citing stub implementation evidence

**GIVEN** a claim that usage tracking is non-functional  
**WHEN** documenting this finding  
**THEN** the audit must include:
- Exact file path (`frontend/src/lib/subscription.ts`)
- Line numbers (63-65)
- Code snippet showing hardcoded return value
- Explanation of why this prevents enforcement

#### Scenario: Citing UI/backend inconsistency

**GIVEN** a claim that interval validation is UI-only  
**WHEN** documenting this finding  
**THEN** the audit must include:
- UI file path and line numbers (newSecretForm.tsx:325-367)
- API file path showing lack of validation (route.ts POST handler)
- Helper function that exists but isn't called (`isIntervalAllowed`)
- Specific impact (users can bypass via direct API calls)

## Metadata

- **Capability:** `tier-enforcement-audit`
- **Type:** Documentation
- **Phase:** Audit
- **Owner:** Product & Engineering
- **Dependencies:** None (audit only)
