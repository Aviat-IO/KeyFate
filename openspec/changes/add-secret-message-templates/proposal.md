## Why

Pro users managing sensitive information need pre-written templates for common scenarios (Bitcoin recovery, estate planning, etc.) to save time and ensure they include all necessary information when creating secrets.

## What Changes

- Restrict message templates to Pro tier only
- Remove template access from Free tier UI
- Add server-side validation to enforce Pro-only template access
- Update pricing page to highlight message templates as Pro feature
- Display templates in "Welcome to Pro!" modal

**Note:** Message templates are already partially implemented in `frontend/src/constants/message-templates.ts` with 7 templates covering cryptocurrency, accounts, estate planning, and digital assets.

## Impact

- Affected specs: secret-message-templates (new)
- Affected code:
  - `frontend/src/components/message-template-selector.tsx` (add tier check)
  - `frontend/src/constants/tiers.ts` (update Free tier description)
  - `frontend/src/constants/pro-features.ts` (add templates feature)
  - Any API endpoints that serve templates (add tier validation)
