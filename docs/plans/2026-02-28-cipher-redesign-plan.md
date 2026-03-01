# The Cipher Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to
> implement this plan task-by-task.

**Goal:** Transform the entire Keyfate frontend from a blue-primary card-heavy
design to "The Cipher" — slate/black palette, Space Grotesk typography, unboxed
content, Keyline motif.

**Architecture:** Bottom-up approach. Change global foundation (fonts, colors,
CSS variables) first, then create shared design primitives (Keyline, DataLabel),
then sweep every page top-to-bottom. Card component defaults are stripped to
invisible. Button text gets uppercase tracking treatment.

**Tech Stack:** SvelteKit 5, Tailwind CSS 4, shadcn-svelte,
@fontsource/space-grotesk, @fontsource/inter

---

### Task 1: Install Font Packages

**Files:**

- Modify: `frontend-svelte/package.json`

**Step 1: Install fonts**

Run:

```bash
cd frontend-svelte && bun add @fontsource/space-grotesk @fontsource/inter
```

**Step 2: Verify installation**

Run:
`ls node_modules/@fontsource/space-grotesk && ls node_modules/@fontsource/inter`
Expected: Directory listings showing font files

**Step 3: Commit**

```bash
git add package.json bun.lock
git commit -m "chore: install Space Grotesk and Inter font packages"
```

---

### Task 2: Update Global CSS Variables (app.css)

**Files:**

- Modify: `frontend-svelte/src/app.css`

**Step 1: Add font imports at the top of app.css**

Add these lines after `@config '../tailwind.config.ts';` (line 2):

```css
@import "@fontsource/space-grotesk/300.css";
@import "@fontsource/space-grotesk/700.css";
@import "@fontsource/inter/400.css";
@import "@fontsource/inter/500.css";
@import "@fontsource/inter/600.css";
```

**Step 2: Replace light mode CSS variables**

Replace the `:root` block (lines 20-73) with:

```css
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --card: 0 0% 100%;
  --card-foreground: 222.2 84% 4.9%;
  --popover: 0 0% 100%;
  --popover-foreground: 222.2 84% 4.9%;
  --primary: 222.2 47.4% 11.2%;
  --primary-foreground: 210 40% 98%;
  --secondary: 210 40% 96.1%;
  --secondary-foreground: 222.2 47.4% 11.2%;
  --muted: 210 40% 96.1%;
  --muted-foreground: 215.4 16.3% 46.9%;
  --accent: 210 40% 96.1%;
  --accent-foreground: 222.2 47.4% 11.2%;
  --destructive: 0 84.2% 60.2%;
  --destructive-foreground: 210 40% 98%;
  --border: 214.3 31.8% 91.4%;
  --input: 214.3 31.8% 91.4%;
  --ring: 222.2 47.4% 11.2%;
  --chart-1: 222.2 47.4% 11.2%;
  --chart-2: 215.4 16.3% 46.9%;
  --chart-3: 210 40% 96.1%;
  --chart-4: 214.3 31.8% 91.4%;
  --chart-5: 222.2 84% 4.9%;
  --sidebar: 210 40% 96.1%;
  --sidebar-foreground: 222.2 84% 4.9%;
  --sidebar-primary: 222.2 47.4% 11.2%;
  --sidebar-primary-foreground: 210 40% 98%;
  --sidebar-accent: 210 40% 96.1%;
  --sidebar-accent-foreground: 222.2 47.4% 11.2%;
  --sidebar-border: 214.3 31.8% 91.4%;
  --sidebar-ring: 222.2 47.4% 11.2%;
  --font-sans: "Inter", sans-serif;
  --font-serif: ui-serif, Georgia, Cambria, "Times New Roman", Times, serif;
  --font-mono: "JetBrains Mono", monospace;
  --font-space: "Space Grotesk", sans-serif;
  --radius: 0.375rem;
  --shadow-2xs: 0 1px 3px 0px hsl(0 0% 0% / 0.05);
  --shadow-xs: 0 1px 3px 0px hsl(0 0% 0% / 0.05);
  --shadow-sm:
    0 1px 3px 0px hsl(0 0% 0% / 0.1), 0 1px 2px -1px hsl(0 0% 0% / 0.1);
  --shadow: 0 1px 3px 0px hsl(0 0% 0% / 0.1), 0 1px 2px -1px hsl(0 0% 0% / 0.1);
  --shadow-md:
    0 1px 3px 0px hsl(0 0% 0% / 0.1), 0 2px 4px -1px hsl(0 0% 0% / 0.1);
  --shadow-lg:
    0 1px 3px 0px hsl(0 0% 0% / 0.1), 0 4px 6px -1px hsl(0 0% 0% / 0.1);
  --shadow-xl:
    0 1px 3px 0px hsl(0 0% 0% / 0.1), 0 8px 10px -1px hsl(0 0% 0% / 0.1);
  --shadow-2xl: 0 1px 3px 0px hsl(0 0% 0% / 0.25);
  --tracking-normal: 0em;
  --spacing: 0.25rem;
}
```

**Step 3: Replace dark mode CSS variables**

Replace the `.dark` block (lines 75-126) with:

```css
.dark {
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;
  --card: 222.2 84% 4.9%;
  --card-foreground: 210 40% 98%;
  --popover: 222.2 84% 4.9%;
  --popover-foreground: 210 40% 98%;
  --primary: 210 40% 98%;
  --primary-foreground: 222.2 47.4% 11.2%;
  --secondary: 217.2 32.6% 17.5%;
  --secondary-foreground: 210 40% 98%;
  --muted: 217.2 32.6% 17.5%;
  --muted-foreground: 215 20.2% 65.1%;
  --accent: 217.2 32.6% 17.5%;
  --accent-foreground: 210 40% 98%;
  --destructive: 0 62.8% 30.6%;
  --destructive-foreground: 210 40% 98%;
  --border: 217.2 32.6% 17.5%;
  --input: 217.2 32.6% 17.5%;
  --ring: 212.7 26.8% 83.9%;
  --chart-1: 210 40% 98%;
  --chart-2: 215 20.2% 65.1%;
  --chart-3: 217.2 32.6% 17.5%;
  --chart-4: 212.7 26.8% 83.9%;
  --chart-5: 222.2 84% 4.9%;
  --sidebar: 222.2 84% 4.9%;
  --sidebar-foreground: 210 40% 98%;
  --sidebar-primary: 210 40% 98%;
  --sidebar-primary-foreground: 222.2 47.4% 11.2%;
  --sidebar-accent: 217.2 32.6% 17.5%;
  --sidebar-accent-foreground: 210 40% 98%;
  --sidebar-border: 217.2 32.6% 17.5%;
  --sidebar-ring: 212.7 26.8% 83.9%;
  --font-sans: "Inter", sans-serif;
  --font-serif: ui-serif, Georgia, Cambria, "Times New Roman", Times, serif;
  --font-mono: "JetBrains Mono", monospace;
  --font-space: "Space Grotesk", sans-serif;
  --radius: 0.375rem;
  --shadow-2xs: 0 1px 3px 0px hsl(0 0% 0% / 0.05);
  --shadow-xs: 0 1px 3px 0px hsl(0 0% 0% / 0.05);
  --shadow-sm:
    0 1px 3px 0px hsl(0 0% 0% / 0.1), 0 1px 2px -1px hsl(0 0% 0% / 0.1);
  --shadow: 0 1px 3px 0px hsl(0 0% 0% / 0.1), 0 1px 2px -1px hsl(0 0% 0% / 0.1);
  --shadow-md:
    0 1px 3px 0px hsl(0 0% 0% / 0.1), 0 2px 4px -1px hsl(0 0% 0% / 0.1);
  --shadow-lg:
    0 1px 3px 0px hsl(0 0% 0% / 0.1), 0 4px 6px -1px hsl(0 0% 0% / 0.1);
  --shadow-xl:
    0 1px 3px 0px hsl(0 0% 0% / 0.1), 0 8px 10px -1px hsl(0 0% 0% / 0.1);
  --shadow-2xl: 0 1px 3px 0px hsl(0 0% 0% / 0.25);
}
```

**Step 4: Update .theme block**

Replace the `.theme` block (lines 128-138) with:

```css
.theme {
  --font-sans: "Inter", sans-serif;
  --font-mono: "JetBrains Mono", monospace;
  --font-serif: ui-serif, Georgia, Cambria, "Times New Roman", Times, serif;
  --font-space: "Space Grotesk", sans-serif;
  --radius: 0.25rem;
  --tracking-tighter: calc(var(--tracking-normal) - 0.05em);
  --tracking-tight: calc(var(--tracking-normal) - 0.025em);
  --tracking-wide: calc(var(--tracking-normal) + 0.025em);
  --tracking-wider: calc(var(--tracking-normal) + 0.05em);
  --tracking-widest: calc(var(--tracking-normal) + 0.1em);
}
```

**Step 5: Build and verify**

Run: `cd frontend-svelte && bun run build` Expected: Successful build

**Step 6: Commit**

```bash
git add src/app.css
git commit -m "feat: update CSS variables to The Cipher slate/black palette with font imports"
```

---

### Task 3: Update Tailwind Config

**Files:**

- Modify: `frontend-svelte/tailwind.config.ts`

**Step 1: Add `space` font family to the extend.fontFamily section**

Add `space: ['var(--font-space)']` to the fontFamily object at line 68-72:

```typescript
fontFamily: {
	sans: ['var(--font-sans)'],
	serif: ['var(--font-serif)'],
	mono: ['var(--font-mono)'],
	space: ['var(--font-space)']
},
```

**Step 2: Build and verify**

Run: `cd frontend-svelte && bun run build` Expected: Successful build

**Step 3: Commit**

```bash
git add tailwind.config.ts
git commit -m "feat: add font-space mapping to Tailwind config"
```

---

### Task 4: Strip Card Component Defaults

**Files:**

- Modify: `frontend-svelte/src/lib/components/ui/card/card.svelte`

**Step 1: Replace the Card's default classes**

Change line 17 from:

```
"bg-card text-card-foreground flex flex-col gap-6 rounded-xl border py-6 shadow-sm",
```

to:

```
"text-card-foreground flex flex-col gap-6",
```

This removes `bg-card`, `rounded-xl`, `border`, `py-6`, `shadow-sm` — making
cards invisible by default. Content floats in negative space. Any page needing
visible containment can add classes via `className`.

**Step 2: Build and run tests**

Run: `cd frontend-svelte && bun run build && bun test` Expected: Build succeeds.
Tests pass (card styling changes shouldn't break test assertions unless tests
check for specific classes).

**Step 3: Commit**

```bash
git add src/lib/components/ui/card/card.svelte
git commit -m "feat: strip Card component to invisible default per The Cipher design"
```

---

### Task 5: Create Keyline Component

**Files:**

- Create: `frontend-svelte/src/lib/components/Keyline.svelte`

**Step 1: Create the component**

```svelte
<script lang="ts">
  let { progress = 0, class: className = '' }: { progress: number; class?: string } = $props();

  let clampedProgress = $derived(Math.max(0, Math.min(100, progress)));
</script>

<div class="relative my-8 h-[2px] w-full bg-muted {className}">
  <div
    class="absolute left-0 top-0 h-full bg-primary transition-all duration-1000"
    style="width: {clampedProgress}%"
  ></div>
  <div
    class="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border-2 border-primary bg-background transition-all duration-1000"
    style="left: {clampedProgress}%"
  ></div>
</div>
```

**Step 2: Build**

Run: `cd frontend-svelte && bun run build` Expected: Successful build

**Step 3: Commit**

```bash
git add src/lib/components/Keyline.svelte
git commit -m "feat: add Keyline progress bar component per The Cipher design"
```

---

### Task 6: Create DataLabel Component

**Files:**

- Create: `frontend-svelte/src/lib/components/DataLabel.svelte`

**Step 1: Create the component**

```svelte
<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    label,
    value = undefined,
    children = undefined,
    class: className = ''
  }: {
    label: string;
    value?: string | number | null;
    children?: Snippet;
    class?: string;
  } = $props();
</script>

<div class={className}>
  <dt class="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</dt>
  {#if children}
    <dd class="mt-1 text-sm text-foreground">
      {@render children()}
    </dd>
  {:else if value !== undefined && value !== null}
    <dd class="mt-1 text-sm text-foreground">{value}</dd>
  {/if}
</div>
```

**Step 2: Build**

Run: `cd frontend-svelte && bun run build` Expected: Successful build

**Step 3: Commit**

```bash
git add src/lib/components/DataLabel.svelte
git commit -m "feat: add DataLabel unboxed metadata component per The Cipher design"
```

---

### Task 7: Update NavBar to The Cipher Aesthetic

**Files:**

- Modify: `frontend-svelte/src/lib/components/NavBar.svelte`

**Step 1: Simplify nav styling**

Change the outer `<nav>` classes (line 40-42) from:

```
class="bg-background/95 supports-[backdrop-filter]:bg-background/60 border-b backdrop-blur"
```

to:

```
class="bg-background/95 supports-[backdrop-filter]:bg-background/60 border-b border-border/50 backdrop-blur"
```

Change container (line 43) from:

```
<div class="container mx-auto px-4">
```

to:

```
<div class="mx-auto max-w-5xl px-6">
```

**Step 2: Update nav link styling to uppercase tracking**

Replace `menuItemClass` (line 32-33) from:

```
'flex select-none items-center gap-2 rounded-md px-3 py-2 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground';
```

to:

```
'flex select-none items-center gap-2 rounded-md px-3 py-2 text-xs font-medium uppercase tracking-wider leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground';
```

Update the desktop nav links (lines 81-116) to add
`text-xs font-medium uppercase tracking-wider` replacing the existing
`text-sm font-medium` where applicable.

**Step 3: Update button text to uppercase**

For the "Recover Secret" button (line 129), "Sign In" (line 147), "Sign Up"
(line 149) — add `uppercase tracking-wide` class overrides.

**Step 4: Build and run tests**

Run: `cd frontend-svelte && bun run build && bun test` Expected: Build passes,
tests pass

**Step 5: Commit**

```bash
git add src/lib/components/NavBar.svelte
git commit -m "feat: update NavBar to The Cipher aesthetic with uppercase tracking"
```

---

### Task 8: Update Footer to The Cipher Aesthetic

**Files:**

- Modify: `frontend-svelte/src/lib/components/Footer.svelte`

**Step 1: Update container and spacing**

Change the footer's container class (line 7) from `max-w-6xl` to `max-w-5xl`.
Add `mt-16` to footer for generous top spacing: change line 5 from:

```
class="border-t border-border/50 bg-background px-6 py-12"
```

to:

```
class="mt-16 border-t border-border/50 bg-background px-6 py-12"
```

**Step 2: Update link styling**

Change link text classes (line 28) to add uppercase tracking:

```
class="flex flex-wrap items-center justify-center gap-8 text-xs uppercase tracking-wider text-muted-foreground"
```

**Step 3: Update tagline styling**

Change tagline (line 51) to:

```
<p class="text-xs uppercase tracking-wider text-muted-foreground/50">Zero-knowledge security. Open source.</p>
```

**Step 4: Build and verify**

Run: `cd frontend-svelte && bun run build` Expected: Successful build

**Step 5: Commit**

```bash
git add src/lib/components/Footer.svelte
git commit -m "feat: update Footer to The Cipher aesthetic"
```

---

### Task 9: Update Landing Page

**Files:**

- Modify: `frontend-svelte/src/routes/+page.svelte`

**Step 1: Read the current landing page**

Read `frontend-svelte/src/routes/+page.svelte` to understand the current
structure.

**Step 2: Apply The Cipher treatment**

Key changes:

- Hero headline: change to
  `font-space text-4xl sm:text-5xl md:text-7xl font-light tracking-tighter` —
  large, lightweight typography
- Remove any Card imports and visible card usage from feature grid and How It
  Works sections
- Replace feature cards with unboxed content blocks using DataLabel-style
  headers
- How It Works: numbered steps without cards, separated by thin
  `<hr class="border-border/50" />` lines
- CTA section: stark outline button with `uppercase tracking-wide font-semibold`
- Replace `container mx-auto` with `mx-auto max-w-5xl px-6`
- Add generous spacing: `py-16 md:py-24` between sections
- Replace any `bg-muted/30` section alternation with plain `bg-background` (or
  very subtle treatment)
- Remove any parallax effects that conflict with the minimal aesthetic

**Step 3: Build and run tests**

Run: `cd frontend-svelte && bun run build && bun test` Expected: Build and tests
pass

**Step 4: Commit**

```bash
git add src/routes/+page.svelte
git commit -m "feat: redesign landing page to The Cipher aesthetic"
```

---

### Task 10: Update Dashboard

**Files:**

- Modify: `frontend-svelte/src/routes/(authenticated)/dashboard/+page.svelte`
- Modify: `frontend-svelte/src/lib/components/SecretsGrid.svelte`
- Modify: `frontend-svelte/src/lib/components/SecretCard.svelte`

**Step 1: Read the current files**

Read all three files to understand current structure.

**Step 2: Update Dashboard page**

- Page title: `font-space text-3xl font-light tracking-tight`
- Add "Create New Secret" button with `uppercase tracking-wide font-semibold`
- Remove any Card wrappers

**Step 3: Update SecretCard**

Replace card-based layout with unboxed row design:

- Secret name as primary text
- Status badge with `variant="outline"`
- DataLabel pairs for recipients, next check-in, timing
- Action buttons as ghost/outline with uppercase text
- Separate secrets with thin `border-b border-border/50` instead of card
  boundaries
- Remove Card component imports

**Step 4: Update SecretsGrid**

Change from card grid (`grid gap-6 md:grid-cols-2 lg:grid-cols-3`) to a vertical
list (`space-y-0 divide-y divide-border/50`) for the unboxed flow.

**Step 5: Build and run tests**

Run: `cd frontend-svelte && bun run build && bun test` Expected: Build and tests
pass

**Step 6: Commit**

```bash
git add src/routes/\(authenticated\)/dashboard/+page.svelte src/lib/components/SecretsGrid.svelte src/lib/components/SecretCard.svelte
git commit -m "feat: redesign dashboard and secret cards to The Cipher aesthetic"
```

---

### Task 11: Update Secret Detail View

**Files:**

- Modify:
  `frontend-svelte/src/routes/(authenticated)/secrets/[id]/view/+page.svelte`

**Step 1: Read the current file**

Read the ~435 line file to understand its 4 Card sections.

**Step 2: Transform the page**

- Remove all Card component imports and usage
- Secret title: `font-space text-3xl font-light tracking-tight`
- Status: outline badge
- Replace Card sections with vertically spaced DataLabel groups using
  `space-y-12`
- Each section separated by generous whitespace, no borders
- Section headers: `font-space text-xl font-bold tracking-tight`
- Actions: horizontal flex row of outline/ghost buttons with
  `uppercase tracking-wide`
- Check-in history table: strip card wrapper, keep table structure
- Labels: `text-xs text-muted-foreground uppercase tracking-wider`

**Step 3: Build and run tests**

Run: `cd frontend-svelte && bun run build && bun test`

**Step 4: Commit**

```bash
git add src/routes/\(authenticated\)/secrets/\[id\]/view/+page.svelte
git commit -m "feat: redesign secret detail view to The Cipher aesthetic"
```

---

### Task 12: Update Secret Create/Edit Forms

**Files:**

- Modify: `frontend-svelte/src/routes/(authenticated)/secrets/new/+page.svelte`
- Modify:
  `frontend-svelte/src/routes/(authenticated)/secrets/[id]/edit/+page.svelte`
- Modify: `frontend-svelte/src/lib/components/NewSecretForm.svelte`
- Modify: `frontend-svelte/src/lib/components/EditSecretForm.svelte`
- Modify: `frontend-svelte/src/lib/components/SecretDetailsForm.svelte`

**Step 1: Read all form files**

**Step 2: Transform**

- Strip card wrappers from forms
- Form labels:
  `text-xs font-medium uppercase tracking-wider text-muted-foreground`
- Page titles: `font-space text-3xl font-light tracking-tight`
- Submit buttons: `uppercase tracking-wide font-semibold`
- Container: `mx-auto max-w-2xl px-6`
- Generous spacing between form sections

**Step 3: Build and run tests**

Run: `cd frontend-svelte && bun run build && bun test`

**Step 4: Commit**

```bash
git add src/routes/\(authenticated\)/secrets/ src/lib/components/NewSecretForm.svelte src/lib/components/EditSecretForm.svelte src/lib/components/SecretDetailsForm.svelte
git commit -m "feat: redesign secret create/edit forms to The Cipher aesthetic"
```

---

### Task 13: Update Share Instructions Page

**Files:**

- Modify:
  `frontend-svelte/src/routes/(authenticated)/secrets/[id]/share-instructions/+page.svelte`

**Step 1: Read and transform**

- Strip card wrappers
- Step numbers as large `font-space` numerals
- Distribution checklist with minimal styling
- Generous spacing between steps

**Step 2: Build and test**

Run: `cd frontend-svelte && bun run build && bun test`

**Step 3: Commit**

```bash
git add src/routes/\(authenticated\)/secrets/\[id\]/share-instructions/+page.svelte
git commit -m "feat: redesign share instructions to The Cipher aesthetic"
```

---

### Task 14: Update Sign-In Page

**Files:**

- Modify: `frontend-svelte/src/routes/sign-in/+page.svelte`

**Step 1: Read and transform**

- Remove card wrapper entirely
- Center form in page with generous padding:
  `flex min-h-screen items-center justify-center`
- Page title: `font-space text-3xl font-light tracking-tight text-center`
- Form inputs with minimal styling (border-b only, or thin border)
- Google OAuth button: `variant="outline"` with uppercase text
- Submit button: uppercase tracking

**Step 2: Build and test**

Run: `cd frontend-svelte && bun run build && bun test`

**Step 3: Commit**

```bash
git add src/routes/sign-in/+page.svelte
git commit -m "feat: redesign sign-in page to The Cipher aesthetic"
```

---

### Task 15: Update Settings Pages

**Files:**

- Modify: `frontend-svelte/src/routes/(authenticated)/settings/+layout.svelte`
- Modify:
  `frontend-svelte/src/routes/(authenticated)/settings/general/+page.svelte`
- Modify:
  `frontend-svelte/src/routes/(authenticated)/settings/subscription/+page.svelte`
- Modify:
  `frontend-svelte/src/routes/(authenticated)/settings/privacy/+page.svelte`
- Modify:
  `frontend-svelte/src/routes/(authenticated)/settings/audit/+page.svelte`
- Modify: `frontend-svelte/src/lib/components/SettingsNav.svelte`
- Modify: `frontend-svelte/src/lib/components/SubscriptionManager.svelte`
- Modify: `frontend-svelte/src/lib/components/DataExportCard.svelte`
- Modify: `frontend-svelte/src/lib/components/AccountDeletionCard.svelte`
- Modify: `frontend-svelte/src/lib/components/AuditLogsPage.svelte`

**Step 1: Read all settings files**

**Step 2: Transform**

- Settings layout: simplify sidebar nav, keep structure but remove card-like
  styling
- Sidebar links: `text-xs font-medium uppercase tracking-wider`
- Page titles: `font-space text-xl font-bold tracking-tight`
- Strip all Card usage from individual settings pages
- Read-only data: use DataLabel component
- Action buttons: uppercase tracking
- SubscriptionManager, DataExportCard, AccountDeletionCard: strip card wrappers,
  use generous spacing

**Step 3: Build and test**

Run: `cd frontend-svelte && bun run build && bun test`

**Step 4: Commit**

```bash
git add src/routes/\(authenticated\)/settings/ src/lib/components/SettingsNav.svelte src/lib/components/SubscriptionManager.svelte src/lib/components/DataExportCard.svelte src/lib/components/AccountDeletionCard.svelte src/lib/components/AuditLogsPage.svelte
git commit -m "feat: redesign settings pages to The Cipher aesthetic"
```

---

### Task 16: Update Pricing Page

**Files:**

- Modify: `frontend-svelte/src/lib/components/PricingPage.svelte`
- Modify: `frontend-svelte/src/lib/components/PricingCard.svelte`
- Modify: `frontend-svelte/src/lib/components/BillingToggle.svelte`

**Step 1: Read all pricing files**

**Step 2: Transform**

- PricingPage: title as `font-space text-3xl font-light tracking-tight`
- PricingCard: remove card borders/shadows. Use columns with generous gap
  instead. Tier names as `font-space font-bold uppercase tracking-wider`.
  Feature lists as unboxed text. CTA buttons:
  `variant="outline" uppercase tracking-wide`
- BillingToggle: minimal styling
- Container: `mx-auto max-w-5xl px-6`

**Step 3: Build and test**

Run: `cd frontend-svelte && bun run build && bun test`

**Step 4: Commit**

```bash
git add src/lib/components/PricingPage.svelte src/lib/components/PricingCard.svelte src/lib/components/BillingToggle.svelte
git commit -m "feat: redesign pricing page to The Cipher aesthetic"
```

---

### Task 17: Update Blog Pages

**Files:**

- Modify: `frontend-svelte/src/routes/blog/+page.svelte`
- Modify: `frontend-svelte/src/routes/blog/[slug]/+page.svelte`

**Step 1: Read both blog files**

**Step 2: Transform blog index**

- Strip article cards. Use typographic list with generous spacing
- Article titles: `font-space text-xl font-light` on hover
- Categories as outline badges
- Date/reading time as `text-xs text-muted-foreground uppercase tracking-wider`
- Featured article: just larger typography, no card

**Step 3: Transform blog post**

- Keep prose styling but update container to `max-w-3xl`
- Title: `font-space text-3xl font-light tracking-tight`
- Metadata: DataLabel pattern
- Category/tag badges: `variant="outline"`

**Step 4: Build and test**

Run: `cd frontend-svelte && bun run build && bun test`

**Step 5: Commit**

```bash
git add src/routes/blog/
git commit -m "feat: redesign blog pages to The Cipher aesthetic"
```

---

### Task 18: Update FAQ Page

**Files:**

- Modify: `frontend-svelte/src/routes/faq/+page.svelte`

**Step 1: Read and transform**

- Strip card wrappers around accordion sections
- Category headers: `font-space text-xl font-bold tracking-tight`
- Keep accordion pattern (functional)
- Replace inline NavBar/Footer with import if layout group supports it, or just
  update inline versions
- Container: `mx-auto max-w-3xl px-6`

**Step 2: Build and test**

Run: `cd frontend-svelte && bun run build && bun test`

**Step 3: Commit**

```bash
git add src/routes/faq/+page.svelte
git commit -m "feat: redesign FAQ page to The Cipher aesthetic"
```

---

### Task 19: Update Legal Pages

**Files:**

- Modify: `frontend-svelte/src/routes/terms-of-service/+page.svelte`
- Modify: `frontend-svelte/src/routes/privacy-policy/+page.svelte`
- Modify: `frontend-svelte/src/routes/(main)/refunds/+page.svelte`

**Step 1: Read and transform**

- Update container widths to `max-w-3xl`
- Ensure typography matches The Cipher patterns
- Refunds: strip Card sections, replace with unboxed content blocks separated by
  generous spacing
- Legal pages: minimal changes needed, mostly container and heading typography

**Step 2: Build and test**

Run: `cd frontend-svelte && bun run build && bun test`

**Step 3: Commit**

```bash
git add src/routes/terms-of-service/ src/routes/privacy-policy/ src/routes/\(main\)/refunds/
git commit -m "feat: redesign legal pages to The Cipher aesthetic"
```

---

### Task 20: Update Remaining Pages

**Files:**

- Modify: `frontend-svelte/src/routes/decrypt/+page.svelte`
- Modify: `frontend-svelte/src/routes/recover/+page.svelte`
- Modify: `frontend-svelte/src/routes/local-instructions/+page.svelte`
- Modify: `frontend-svelte/src/routes/profile/+page.svelte`
- Modify: `frontend-svelte/src/routes/confirm-deletion/+page.svelte`
- Modify: `frontend-svelte/src/routes/auth/error/+page.svelte`

**Step 1: Read all files**

**Step 2: Transform each page**

- decrypt: strip cards from SSSDecryptor, update typography
- recover: strip cards, fix `text-green-500` violation → use semantic color,
  update step headers to `font-space`
- local-instructions: strip two cards, use unboxed content blocks
- profile: strip card, use DataLabel for form fields
- confirm-deletion: fix `text-green-600` violation → semantic, strip card
- auth/error: fix `bg-white` violation, strip card, center content with
  typography

**Step 3: Build and run ALL tests**

Run: `cd frontend-svelte && bun run build && bun test` Expected: All 303 tests
pass

**Step 4: Commit**

```bash
git add src/routes/decrypt/ src/routes/recover/ src/routes/local-instructions/ src/routes/profile/ src/routes/confirm-deletion/ src/routes/auth/error/
git commit -m "feat: redesign remaining pages to The Cipher aesthetic"
```

---

### Task 21: Update Layout Files

**Files:**

- Modify: `frontend-svelte/src/routes/(main)/+layout.svelte`
- Modify: `frontend-svelte/src/routes/(authenticated)/+layout.svelte`
- Modify: `frontend-svelte/src/routes/blog/+layout.svelte`

**Step 1: Read and update layouts**

- Ensure all layouts use consistent NavBar patterns
- Update any `container mx-auto` to `mx-auto max-w-5xl px-6`
- Ensure `<main>` elements have generous top padding `py-12`

**Step 2: Build and test**

Run: `cd frontend-svelte && bun run build && bun test`

**Step 3: Commit**

```bash
git add src/routes/\(main\)/+layout.svelte src/routes/\(authenticated\)/+layout.svelte src/routes/blog/+layout.svelte
git commit -m "feat: update layout files to The Cipher container and spacing standards"
```

---

### Task 22: Update Badge Component Default

**Files:**

- Modify: `frontend-svelte/src/lib/components/ui/badge/badge.svelte`

**Step 1: Set default variant to outline**

Change line 18 from:

```
variant: "default",
```

to:

```
variant: "outline",
```

This makes badges transparent-background outline style by default, matching
DESIGN.md's preference.

**Step 2: Build and test**

Run: `cd frontend-svelte && bun run build && bun test`

**Step 3: Commit**

```bash
git add src/lib/components/ui/badge/badge.svelte
git commit -m "feat: set Badge default variant to outline per The Cipher design"
```

---

### Task 23: Update Remaining Components

**Files:**

- Modify: Any remaining components that use Card, hardcoded colors, or don't
  follow The Cipher patterns
- Check: `frontend-svelte/src/lib/components/UpgradeModal.svelte`
- Check: `frontend-svelte/src/lib/components/TierUsageCard.svelte`
- Check: `frontend-svelte/src/lib/components/UsageIndicator.svelte`
- Check: `frontend-svelte/src/lib/components/ContactMethodsForm.svelte`
- Check: `frontend-svelte/src/lib/components/ContactMethodsDialog.svelte`
- Check: `frontend-svelte/src/lib/components/RecoveryGuide.svelte`
- Check: `frontend-svelte/src/lib/components/SSSDecryptor.svelte`

**Step 1: Read and audit each component**

Search for:

- Card imports/usage
- Hardcoded colors (`text-blue`, `text-green`, `bg-white`, etc.)
- Missing uppercase tracking on buttons/labels
- Missing `font-space` on headings

**Step 2: Fix violations**

Apply The Cipher patterns to all remaining components.

**Step 3: Build and run full test suite**

Run: `cd frontend-svelte && bun run build && bun test` Expected: All 303 tests
pass

**Step 4: Commit**

```bash
git add src/lib/components/
git commit -m "feat: update remaining components to The Cipher aesthetic"
```

---

### Task 24: Final Verification

**Step 1: Run full build**

Run: `cd frontend-svelte && bun run build` Expected: Successful build with no
errors

**Step 2: Run full test suite**

Run: `cd frontend-svelte && bun test` Expected: All 303 tests pass

**Step 3: Run type checking**

Run: `cd frontend-svelte && bun run check` Expected: No type errors
(pre-existing errors in confirm-deletion may persist)

**Step 4: Search for remaining violations**

Run:

```bash
cd frontend-svelte && rg -n 'text-blue-|text-green-|text-red-|bg-white|bg-blue-|bg-green-|bg-red-' src/ --include '*.svelte' --include '*.ts'
```

Expected: No matches (or only in test fixtures/mocks)

**Step 5: Commit any final fixes**

```bash
git add -A
git commit -m "chore: final The Cipher design verification and cleanup"
```
