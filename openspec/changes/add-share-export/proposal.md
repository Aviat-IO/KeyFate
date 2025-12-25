# Add Share Export for Data Sovereignty

## Why

Users have raised legitimate concerns about business continuity: "What happens to
my secrets if KeyFate goes out of business?" Currently, if KeyFate becomes
unavailable, users cannot access their server-stored share, making secret
reconstruction impossible. This undermines trust and creates vendor lock-in that
conflicts with our zero-knowledge philosophy.

Users should have complete control over their data. The ability to export and
backup their server-stored share ensures they can reconstruct secrets using
open-source tools, with or without KeyFate.

## What Changes

- Add share export functionality for individual secrets (Pro tier)
- Provide encrypted backup file format with reconstruction instructions
- Create offline reconstruction tool documentation
- Add backup reminder system (periodic email prompts)
- Update FAQ and documentation about data sovereignty

## Impact

- **Affected specs:** `data-protection` (adds Share Export requirement)
- **Affected code:**
  - `frontend/src/app/(authenticated)/secrets/[id]/page.tsx` - Add export button
  - `frontend/src/app/api/secrets/[id]/export/route.ts` - Export API endpoint (new)
  - `frontend/src/lib/crypto/` - Export format utilities
  - `frontend/src/components/secrets/ShareExportDialog.tsx` - Export UI (new)
- **Breaking changes:** None (additive only)
- **Security impact:**
  - Export is additional share copy (doesn't increase reconstruction risk)
  - Exported file is already encrypted with user's key
  - Download requires authentication and rate limiting
- **Privacy impact:** None (user is exporting their own data)
- **Tier requirement:** Pro users only (Free tier has simpler use case)
