# Keyfate UI Design Explorations Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to
> implement this plan task-by-task.

**Goal:** Create a standalone HTML page showcasing 6 distinct design ethos
explorations for the Keyfate Dead Man's Switch dashboard.

**Architecture:** A single `designs.html` file using Tailwind CSS via CDN and
Vanilla JS for tab navigation and basic interactivity (like countdown timers).

**Tech Stack:** HTML5, Tailwind CSS (CDN), Vanilla JavaScript.

---

### Task 1: Setup HTML skeleton and navigation

**Files:**

- Create: `keyfate-designs.html`

**Step 1: Write the basic HTML structure**

Create the HTML file with Tailwind CDN, Google Fonts (for various themes), and
the basic tab navigation structure.

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Keyfate Design Explorations</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link
      href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&family=JetBrains+Mono:wght@400;700&family=Space+Grotesk:wght@500;700&display=swap"
      rel="stylesheet"
    />
    <script>
      tailwind.config = {
        theme: {
          extend: {
            fontFamily: {
              sans: ["Inter", "sans-serif"],
              mono: ["JetBrains Mono", "monospace"],
              space: ["Space Grotesk", "sans-serif"],
            },
          },
        },
      };
    </script>
    <style>
      .tab-content {
        display: none;
      }
      .tab-content.active {
        display: block;
      }
    </style>
  </head>
  <body class="flex h-screen flex-col bg-gray-100 text-gray-900">
    <nav
      class="z-50 flex shrink-0 space-x-4 overflow-x-auto border-b border-gray-200 bg-white px-4 py-3 shadow-sm"
    >
      <button
        onclick="showTab('vault')"
        class="rounded-md px-3 py-2 text-sm font-medium hover:bg-gray-100 focus:outline-none"
      >
        1. The Vault
      </button>
      <button
        onclick="showTab('terminal')"
        class="rounded-md px-3 py-2 text-sm font-medium hover:bg-gray-100 focus:outline-none"
      >
        2. The Terminal
      </button>
      <button
        onclick="showTab('lifeline')"
        class="rounded-md px-3 py-2 text-sm font-medium hover:bg-gray-100 focus:outline-none"
      >
        3. The Lifeline
      </button>
      <button
        onclick="showTab('artifact')"
        class="rounded-md px-3 py-2 text-sm font-medium hover:bg-gray-100 focus:outline-none"
      >
        4. The Artifact
      </button>
      <button
        onclick="showTab('sentinel')"
        class="rounded-md px-3 py-2 text-sm font-medium hover:bg-gray-100 focus:outline-none"
      >
        5. The Sentinel
      </button>
      <button
        onclick="showTab('panic')"
        class="rounded-md px-3 py-2 text-sm font-medium hover:bg-gray-100 focus:outline-none"
      >
        6. The Panic Room
      </button>
    </nav>
    <div id="vault" class="tab-content active h-full w-full"></div>
    <div id="terminal" class="tab-content h-full w-full"></div>
    <div id="lifeline" class="tab-content h-full w-full"></div>
    <div id="artifact" class="tab-content h-full w-full"></div>
    <div id="sentinel" class="tab-content h-full w-full"></div>
    <div id="panic" class="tab-content h-full w-full"></div>

    <script>
      function showTab(id) {
        document
          .querySelectorAll(".tab-content")
          .forEach((el) => el.classList.remove("active"));
        document.getElementById(id).classList.add("active");
      }
      // Basic countdown logic to be used across designs
      const countdownDate = new Date(
        new Date().getTime() + 7 * 24 * 60 * 60 * 1000,
      ).getTime();
    </script>
  </body>
</html>
```

**Step 2: Check rendering** Run: `open keyfate-designs.html` Expected: A white
nav bar with 6 buttons and a blank page. Clicking buttons should theoretically
switch hidden divs.

---

### Task 2: Implement "The Vault" (Brutalist)

**Files:**

- Modify: `keyfate-designs.html`

**Step 1: Write the layout** Inject the HTML into the `<div id="vault">`. Use
`font-mono`, raw concrete grays, thick black borders, and a large toggle switch.

**Step 2: Verify visually** Open in browser to verify the brutalist styling.

---

### Task 3: Implement "The Terminal" (Cyberpunk)

**Files:**

- Modify: `keyfate-designs.html`

**Step 1: Write the layout** Inject the HTML into the `<div id="terminal">`. Use
black background, green `text-green-500` monospace fonts, a blinking cursor
effect via CSS, and raw data outputs.

**Step 2: Verify visually** Check browser.

---

### Task 4: Implement "The Lifeline" (Medical/Minimalist)

**Files:**

- Modify: `keyfate-designs.html`

**Step 1: Write the layout** Inject into `<div id="lifeline">`. Use pure white,
light grays, a soft red pulse animation (`animate-pulse`), and a circular SVG
progress ring mimicking a heart monitor.

**Step 2: Verify visually** Check browser.

---

### Task 5: Implement "The Artifact" (Premium/Crypto)

**Files:**

- Modify: `keyfate-designs.html`

**Step 1: Write the layout** Inject into `<div id="artifact">`. Use a dark
gradient background (e.g. `bg-slate-900` to `bg-black`), glassmorphism cards
(`bg-white/5 backdrop-blur-md`), and gold/bronze accents (`text-amber-500`).

**Step 2: Verify visually** Check browser.

---

### Task 6: Implement "The Sentinel" (Modern SaaS)

**Files:**

- Modify: `keyfate-designs.html`

**Step 1: Write the layout** Inject into `<div id="sentinel">`. Use a clean
standard SaaS dashboard layout (sidebar/header), clean white cards on an
off-white background, subtle blue active states (resembling Shadcn).

**Step 2: Verify visually** Check browser.

---

### Task 7: Implement "The Panic Room" (High-Alert)

**Files:**

- Modify: `keyfate-designs.html`

**Step 1: Write the layout** Inject into `<div id="panic">`. Use stark black
background, bright warning reds, thick diagonal hazard stripes (CSS
linear-gradient), and a massive pulsating "CHECK IN" button.

**Step 2: Verify visually** Check browser.

---

### Task 8: Add functional JS to update the timers dynamically.

**Files:**

- Modify: `keyfate-designs.html`

**Step 1: Write the JS** Add a setInterval loop to update all countdown elements
simultaneously.
