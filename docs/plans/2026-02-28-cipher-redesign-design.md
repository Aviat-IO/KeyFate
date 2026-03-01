# The Cipher Redesign — Full Site Design Document

**Date:** 2026-02-28 **Scope:** Full site redesign of frontend-svelte to match
DESIGN.md ("The Cipher") **Approach:** Bottom-up foundation (global theme first,
then page sweeps)

## Current State

The site uses a bright-blue primary color, card-heavy layouts, no custom fonts
(Space Grotesk missing entirely, Inter referenced but not imported), and
standard compact card-grid patterns. This contradicts DESIGN.md's vision of
extreme typography, unboxed content, slate/black palette, and the Keyline motif.

## Phase 1: Foundation

### 1.1 Fonts

- Install `@fontsource/space-grotesk` (weights 300, 700)
- Install `@fontsource/inter` (weights 400, 500, 600)
- Import both in `app.css`
- Add `--font-space: 'Space Grotesk', sans-serif` to CSS variables
- Add `font-space` to `tailwind.config.ts` font families
- Update `--font-sans` to use imported Inter

### 1.2 Color Palette

Replace all CSS variables in `app.css`:

**Light Mode (`:root`):**

| Variable                   | New Value (HSL)     |
| -------------------------- | ------------------- |
| `--background`             | `0 0% 100%`         |
| `--foreground`             | `222.2 84% 4.9%`    |
| `--primary`                | `222.2 47.4% 11.2%` |
| `--primary-foreground`     | `210 40% 98%`       |
| `--muted`                  | `210 40% 96.1%`     |
| `--muted-foreground`       | `215.4 16.3% 46.9%` |
| `--border`                 | `214.3 31.8% 91.4%` |
| `--card`                   | `0 0% 100%`         |
| `--card-foreground`        | `222.2 84% 4.9%`    |
| `--secondary`              | `210 40% 96.1%`     |
| `--secondary-foreground`   | `222.2 47.4% 11.2%` |
| `--accent`                 | `210 40% 96.1%`     |
| `--accent-foreground`      | `222.2 47.4% 11.2%` |
| `--destructive`            | `0 84.2% 60.2%`     |
| `--destructive-foreground` | `210 40% 98%`       |
| `--input`                  | `214.3 31.8% 91.4%` |
| `--ring`                   | `222.2 47.4% 11.2%` |

**Dark Mode (`.dark`):**

| Variable                   | New Value (HSL)     |
| -------------------------- | ------------------- |
| `--background`             | `222.2 84% 4.9%`    |
| `--foreground`             | `210 40% 98%`       |
| `--primary`                | `210 40% 98%`       |
| `--primary-foreground`     | `222.2 47.4% 11.2%` |
| `--muted`                  | `217.2 32.6% 17.5%` |
| `--muted-foreground`       | `215 20.2% 65.1%`   |
| `--border`                 | `217.2 32.6% 17.5%` |
| `--card`                   | `222.2 84% 4.9%`    |
| `--card-foreground`        | `210 40% 98%`       |
| `--secondary`              | `217.2 32.6% 17.5%` |
| `--secondary-foreground`   | `210 40% 98%`       |
| `--accent`                 | `217.2 32.6% 17.5%` |
| `--accent-foreground`      | `210 40% 98%`       |
| `--destructive`            | `0 62.8% 30.6%`     |
| `--destructive-foreground` | `210 40% 98%`       |
| `--input`                  | `217.2 32.6% 17.5%` |
| `--ring`                   | `212.7 26.8% 83.9%` |

### 1.3 Card Component

Strip Card base styles: `border-0 shadow-none bg-transparent` as default. The
Card component remains for semantic/structural use but is visually invisible.

### 1.4 Button Styling

- Primary actions: `variant="outline"` or `variant="default"` with
  `uppercase tracking-wide font-semibold`
- Secondary: `variant="ghost"`
- All button text gets `uppercase tracking-wide` treatment

## Phase 2: Shared Components

### 2.1 Keyline Component

Reusable progress bar per DESIGN.md:

- 2px thin line, full width
- `bg-muted` track, `bg-primary` fill
- Indicator dot: `bg-background border-primary` circle at progress point
- Props: `progress` (0-100)
- File: `src/lib/components/Keyline.svelte`

### 2.2 DataLabel Component

Unboxed metadata display pattern:

- Label: `text-xs text-muted-foreground uppercase tracking-wider font-medium`
- Value: `text-sm text-foreground` or `text-base text-foreground`
- No borders, no backgrounds
- File: `src/lib/components/DataLabel.svelte`

### 2.3 Typography Patterns

| Element      | Classes                                                                                          |
| ------------ | ------------------------------------------------------------------------------------------------ |
| Page title   | `font-space text-3xl font-light tracking-tight`                                                  |
| Section head | `font-space text-xl font-bold tracking-tight`                                                    |
| Data label   | `text-xs text-muted-foreground uppercase tracking-wider`                                         |
| Body         | `font-sans text-sm text-foreground`                                                              |
| Button text  | `uppercase tracking-wide font-semibold text-sm`                                                  |
| Countdown    | `font-space text-[6rem] sm:text-[8rem] md:text-[12rem] font-light leading-none tracking-tighter` |

### 2.4 Layout Standards

- Container: `max-w-5xl mx-auto px-6`
- Section spacing: `py-12 md:py-16`
- Content spacing: `space-y-8`
- Metadata rows: `flex flex-col md:flex-row justify-between gap-8`

## Phase 3: Page Transformations

### Dashboard (`/dashboard`)

- Massive countdown timer as focal point (time until next check-in)
- Keyline below countdown showing progress
- Replace card grid with unboxed secret list: rows with DataLabel pairs
- Status badges: `variant="outline"` with transparent bg
- Empty state: large centered typography

### Secret Detail (`/secrets/[id]/view`)

- Remove all 4 Card sections
- Vertically stacked DataLabel groups with generous whitespace
- Title: `font-space text-3xl font-light`
- Status: outline badge
- Actions: horizontal row of outline/ghost buttons, uppercase
- Check-in history: table without card wrapper

### Secret Create/Edit (`/secrets/new`, `/secrets/[id]/edit`)

- Strip form cards
- Fields float in space with uppercase tracking-wider labels
- Keep functional form structure

### Landing Page (`/`)

- Hero: massive `font-space` headline, light weight
- Remove feature cards, use unboxed content blocks
- How It Works: numbered steps without cards, thin line separators
- CTA: stark outline button, uppercase

### Sign-In (`/sign-in`)

- Strip card wrapper
- Centered form floating in space
- Minimal input styling
- Google OAuth: outline, uppercase

### Settings (`/settings/*`)

- Strip all cards
- Keep sidebar nav, simplify styling
- DataLabel pattern for read-only data

### Pricing (`/pricing`)

- Replace cards with columns separated by gaps or thin vertical lines
- Unboxed feature lists
- CTA buttons: outline, uppercase

### Blog (`/blog`, `/blog/[slug]`)

- Index: strip article cards, typographic list with spacing
- Post: keep prose, update typography

### FAQ (`/faq`)

- Keep accordion. Strip card wrappers
- Category headers: `font-space`

### Legal Pages (`/terms-of-service`, `/privacy-policy`, `/refunds`)

- Update container width
- Strip card wrappers from refunds
- Match typography

### Other Pages (`/decrypt`, `/recover`, `/local-instructions`, `/profile`, `/confirm-deletion`, `/auth/error`)

- Apply global patterns: strip cards, DataLabel styling, generous spacing
- Fix literal color violations (`bg-white`, `text-green-600`, `text-green-500`)
- Normalize inline NavBar/Footer usage

## Testing Strategy

- `bun run build` must pass after each phase
- `bun test` must pass (303 tests)
- `bun run check` for type checking
- Visual review of light/dark modes
