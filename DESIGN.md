# Keyfate Design System: "The Cipher"

This document outlines the design language, color semantics, typography, and
component usage for building the Keyfate application UI. The design ethos is
named **"The Cipher"**—a blend of extreme typography-driven minimalism, the
Sentinel's professional aesthetic, and the cryptographic necessity of a dead
man's switch.

## 1. Design Ethos & Motif

"The Cipher" represents access, cryptography, and stark truth.

**Visual Themes:**

- **Extreme Typography:** The countdown timer dominates the screen. It is
  massive, lightweight, and precise.
- **The Keyline:** A single, thin, linear progress bar acts as a "keyline"
  cutting across the layout horizontally. This represents the flow of time and
  the reassembly of keys.
- **Unboxed Content:** We actively avoid drawing "cards" or "boxes" around data.
  Information floats in carefully orchestrated negative space.
- **Motifs:** Owl (Vigilance/Observation), Shield (Protection), Key
  (Access/Cryptography).

## 2. Typography

We utilize two primary typefaces, imported via Google Fonts or bundled in the
project:

- **Display & Numbers (The Countdown):** `Space Grotesk`
  - Usage: The massive countdown timer, major section headers.
  - Weights: Light (300) for massive numbers to avoid them feeling "heavy" or
    overwhelming; Bold (700) for structural accents.
  - Class mapping: `font-space`
- **UI Text & Data:** `Inter`
  - Usage: Buttons, labels, status text, descriptions, standard UI elements.
  - Weights: Regular (400) for body text; Medium (500) and SemiBold (600) for
    labels and emphasis.
  - Class mapping: `font-sans`

## 3. Semantic Color System (Shadcn Variables)

We strictly use Shadcn semantic CSS variables defined in `app.css`. The
aesthetic requires stark, high-contrast black/white foundations with subtle,
professional slate/blue accents. **Never use hardcoded Tailwind colors (e.g.,
`text-blue-500`) for structural UI elements.**

The app fully supports both Dark and Light modes based on system preference.

### Light Mode (`:root`)

- **Background (`--background`):** Pure white `0 0% 100%`
- **Foreground (`--foreground`):** Deep Slate `222.2 84% 4.9%`
- **Primary (`--primary`):** Deep Slate/Black `222.2 47.4% 11.2%` (Used for
  primary buttons, prominent text)
- **Primary Foreground (`--primary-foreground`):** White `210 40% 98%`
- **Muted (`--muted`):** Very Light Slate `210 40% 96.1%` (Used for subtle
  backgrounds, secondary inactive areas)
- **Muted Foreground (`--muted-foreground`):** Slate Gray `215.4 16.3% 46.9%`
  (Used for secondary text, labels, subtle icons)
- **Border (`--border`):** Light Gray `214.3 31.8% 91.4%`
- **Accent/Success (Custom):** Emerald/Green for "SECURE" status. (Usually
  mapped to a custom variable or relying on Tailwind's `text-emerald-500`
  strictly for status indicators, not structural elements).

### Dark Mode (`.dark`)

- **Background (`--background`):** Deepest Slate/Black `222.2 84% 4.9%`
- **Foreground (`--foreground`):** Slate White `210 40% 98%`
- **Primary (`--primary`):** Slate White `210 40% 98%` (Used for primary
  buttons, prominent text)
- **Primary Foreground (`--primary-foreground`):** Deep Slate
  `222.2 47.4% 11.2%`
- **Muted (`--muted`):** Dark Slate `217.2 32.6% 17.5%`
- **Muted Foreground (`--muted-foreground`):** Slate Gray `215 20.2% 65.1%`
- **Border (`--border`):** Dark Slate `217.2 32.6% 17.5%`

## 4. Shadcn Svelte Component Usage

To maintain "The Cipher" aesthetic, Shadcn components must be utilized with
specific constraints:

- **`Button`**
  - _Primary Actions (Authenticate):_ Use `variant="outline"` or
    `variant="default"`. Ensure they have a strong, stark contrast. Use
    `uppercase tracking-wide font-semibold` for the text.
  - _Secondary Actions:_ Use `variant="ghost"`.
- **`Card`**
  - _Constraint:_ **DO NOT use standard visible cards.** "The Cipher" relies on
    unboxed text.
  - _Usage:_ If a `Card` component is structurally necessary, it MUST be
    stripped of its borders and background. Use classes like
    `border-0 shadow-none bg-transparent`.
- **`Separator`**
  - _Usage:_ Use sparingly. The "Keyline" progress bar is the primary horizontal
    divider. Standard separators should only be used to divide dense metadata
    (if absolutely necessary).
- **`Badge`**
  - _Usage:_ For status indicators (e.g., "SECURE"). Prefer `variant="outline"`
    with a transparent background and semantic text color (e.g., Emerald/Green
    for secure).

## 5. Building "The Keyline" & Specific Visual Elements

### The Massive Countdown

This is the focal point of the application. It should be built using standard
semantic HTML but styled aggressively:

```html
<div
  class="font-space text-foreground -ml-2 mb-4 text-[6rem] font-light leading-none tracking-tighter sm:text-[8rem] md:text-[12rem]"
>
  168:00
</div>
```

### The Keyline (Progress Bar)

The progress bar acts as a structural divider. It is thin and elegant.

```html
<!-- Container -->
<div class="bg-muted relative my-8 h-[2px] w-full">
  <!-- Active Progress -->
  <div
    class="bg-primary absolute left-0 top-0 h-full transition-all duration-1000"
    style="width: 80%"
  >
  </div>
  <!-- The "Key" (Indicator Dot) -->
  <div
    class="bg-background border-primary absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border-2 transition-all duration-1000"
    style="left: 80%"
  >
  </div>
</div>
```

## 6. Layout & Whitespace Guidelines

- **Negative Space:** This design lives and dies by its whitespace. Use generous
  margins (`mt-8`, `mb-12`, `py-16`). Do not cramp elements.
- **Alignment:**
  - The core interaction (countdown and keyline) should stretch across the
    max-width container.
  - Metadata (Payloads, Last Auth) should sit below the keyline in a horizontal
    flex layout (`flex flex-col md:flex-row justify-between`).
- **Container Constraint:** Content should generally be bound to a `max-w-5xl`
  or `max-w-7xl` container, centered on the screen, allowing for massive padding
  on ultra-wide displays.
- **Unboxed Text:** Data labels should be small, muted, and uppercase
  (`text-xs text-muted-foreground uppercase tracking-wider`). The data value
  itself should be slightly larger and use the primary foreground color. Do not
  put a border around these pairs.
