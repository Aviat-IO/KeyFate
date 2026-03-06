# Keyfate Sentinel Variations Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to
> implement this plan task-by-task.

**Goal:** Create a standalone HTML page showcasing 3 minimalist variations of
the "Sentinel" dashboard design, aligning with the "Owl/Shield/Key" ethos and
stripping away generic SaaS cards.

**Architecture:** A single `sentinel-variations.html` file using Tailwind CSS
via CDN and Vanilla JS for tab navigation and dynamic timers.

**Tech Stack:** HTML5, Tailwind CSS (CDN), Vanilla JavaScript.

---

### Task 1: Setup HTML skeleton and navigation

**Files:**

- Create: `sentinel-variations.html`

**Step 1: Write the basic HTML structure**

Create the HTML file with Tailwind CDN, Inter and Space Grotesk Google Fonts,
and the basic tab navigation structure.

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Sentinel Variations - Keyfate</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link
      href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@300;400;500;600;700&display=swap"
      rel="stylesheet"
    />
    <script>
      tailwind.config = {
        theme: {
          extend: {
            fontFamily: {
              sans: ["Inter", "sans-serif"],
              space: ["Space Grotesk", "sans-serif"],
            },
            colors: {
              brand: {
                50: "#f0f9ff",
                100: "#e0f2fe",
                500: "#0ea5e9",
                600: "#0284c7",
                900: "#0c4a6e",
                950: "#082f49",
              },
            },
          },
        },
      };
    </script>
    <style>
      body,
      html {
        height: 100%;
        margin: 0;
        overflow: hidden;
      }
      .tab-content {
        display: none;
        height: calc(100vh - 64px);
      }
      .tab-content.active {
        display: flex;
      }
    </style>
  </head>
  <body class="flex flex-col bg-slate-50 font-sans text-slate-800">
    <!-- Navigation -->
    <nav
      class="z-50 flex shrink-0 justify-center space-x-6 border-b border-slate-200 bg-white/80 px-6 py-4 backdrop-blur-md"
    >
      <button
        onclick="showTab('owl', this)"
        class="nav-btn active text-brand-600 border-brand-600 border-b-2 px-1 pb-1 text-sm font-semibold transition-colors"
      >
        1. The Vigil's Eye (Owl)
      </button>
      <button
        onclick="showTab('shield', this)"
        class="nav-btn border-b-2 border-transparent px-1 pb-1 text-sm font-medium text-slate-500 transition-colors hover:text-slate-800"
      >
        2. The Aegis (Shield)
      </button>
      <button
        onclick="showTab('key', this)"
        class="nav-btn border-b-2 border-transparent px-1 pb-1 text-sm font-medium text-slate-500 transition-colors hover:text-slate-800"
      >
        3. The Cipher (Key)
      </button>
    </nav>

    <!-- Content Containers -->
    <div
      id="owl"
      class="tab-content active relative flex-col items-center justify-center overflow-hidden bg-slate-50 p-8"
    >
    </div>
    <div
      id="shield"
      class="tab-content relative flex-col items-center justify-center overflow-y-auto bg-slate-100 p-8"
    >
    </div>
    <div
      id="key"
      class="tab-content relative flex-col items-center justify-center bg-white p-8"
    >
    </div>

    <script>
      function showTab(id, btnElement) {
        document
          .querySelectorAll(".tab-content")
          .forEach((el) => el.classList.remove("active"));
        document.getElementById(id).classList.add("active");

        document.querySelectorAll(".nav-btn").forEach((btn) => {
          btn.className =
            "nav-btn text-sm font-medium text-slate-500 border-b-2 border-transparent hover:text-slate-800 pb-1 px-1 transition-colors";
        });
        btnElement.className =
          "nav-btn active text-sm font-semibold text-brand-600 border-b-2 border-brand-600 pb-1 px-1 transition-colors";
      }

      // Setup countdown logic structure
      const targetDate = new Date().getTime() + 7 * 24 * 60 * 60 * 1000;
      function updateCountdowns() {
        // Will implement later
      }
      setInterval(updateCountdowns, 1000);
    </script>
  </body>
</html>
```

---

### Task 2: Implement "The Vigil's Eye (Owl)"

**Files:**

- Modify: `sentinel-variations.html`

**Step 1: Write the layout** Inject HTML into `<div id="owl">`. This uses the
Lifeline concept (a large center ring) but with Sentinel colors (blues/slates).
The ring acts like an eye. Information floats around it freely without "card"
borders.

```html
<!-- Inner content for owl -->
<div
  class="bg-brand-50 pointer-events-none absolute left-1/2 top-1/2 h-[800px] w-[800px] -translate-x-1/2 -translate-y-1/2 transform rounded-full opacity-50 blur-[120px]"
>
</div>

<div class="z-10 flex w-full max-w-2xl flex-col items-center">
  <!-- Header Logo Area -->
  <div class="mb-12 flex flex-col items-center">
    <svg
      class="text-brand-600 mb-4 h-8 w-8"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="1.5"
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      >
      </path>
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="1.5"
        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
      >
      </path>
    </svg>
    <h1 class="text-xl font-medium uppercase tracking-wide text-slate-800">
      System Vigilant
    </h1>
  </div>

  <!-- The Eye (Ring) -->
  <div class="group relative mb-16 h-80 w-80">
    <!-- Decorative rotating dashed ring -->
    <svg
      class="absolute inset-0 h-full w-full animate-[spin_60s_linear_infinite] opacity-20"
      viewBox="0 0 100 100"
    >
      <circle
        cx="50"
        cy="50"
        r="48"
        fill="none"
        stroke="#0ea5e9"
        stroke-width="0.5"
        stroke-dasharray="4 4"
      >
      </circle>
    </svg>

    <svg class="h-full w-full -rotate-90 transform" viewBox="0 0 100 100">
      <circle
        cx="50"
        cy="50"
        r="45"
        fill="none"
        stroke="#e2e8f0"
        stroke-width="1.5"
      >
      </circle>
      <circle
        cx="50"
        cy="50"
        r="45"
        fill="none"
        stroke="#0ea5e9"
        stroke-width="2"
        stroke-dasharray="283"
        stroke-dashoffset="56"
        class="transition-all duration-1000"
      >
      </circle>
    </svg>

    <div class="absolute inset-0 flex flex-col items-center justify-center">
      <span
        class="text-brand-600 mb-2 text-sm font-medium uppercase tracking-widest"
      >T-Minus</span>
      <div
        class="font-space the-countdown-clean text-5xl font-bold tracking-tight text-slate-800"
      >
        7d 0h 0m
      </div>
    </div>
  </div>

  <!-- Action & Floating Stats -->
  <div class="flex w-full flex-col items-center">
    <button
      class="hover:bg-brand-600 group mb-12 flex items-center rounded-full bg-slate-900 px-12 py-4 text-lg font-medium text-white shadow-lg shadow-slate-900/20 transition-all duration-300 active:scale-95"
    >
      Acknowledge Signal
      <svg
        class="ml-3 h-5 w-5 opacity-50 transition-opacity duration-300 group-hover:translate-x-1 group-hover:opacity-100"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M14 5l7 7m0 0l-7 7m7-7H3"
        >
        </path>
      </svg>
    </button>

    <div
      class="flex w-full max-w-md justify-between border-t border-slate-200 px-4 pt-8"
    >
      <div class="flex flex-col items-center">
        <span class="mb-1 text-xs uppercase tracking-wider text-slate-400"
        >Payloads</span>
        <span class="text-sm font-medium text-slate-700">3 Active</span>
      </div>
      <div class="flex flex-col items-center">
        <span class="mb-1 text-xs uppercase tracking-wider text-slate-400"
        >Last Check</span>
        <span class="text-sm font-medium text-slate-700">2 hrs ago</span>
      </div>
      <div class="flex flex-col items-center">
        <span class="mb-1 text-xs uppercase tracking-wider text-slate-400"
        >Status</span>
        <span
          class="flex items-center text-sm font-medium text-emerald-600"
        ><span
            class="mr-2 h-1.5 w-1.5 rounded-full bg-emerald-500"
          ></span>Secure</span>
      </div>
    </div>
  </div>
</div>
```

---

### Task 3: Implement "The Aegis (Shield)"

**Files:**

- Modify: `sentinel-variations.html`

**Step 1: Write the layout** Inject HTML into `<div id="shield">`. This
variation replaces grid cards with a single unified, gently curved container in
the middle of the screen, creating a "monolith" or shield feeling.

```html
<!-- Inner content for shield -->
<div
  class="relative z-10 mb-8 mt-8 flex w-full max-w-[540px] flex-col items-center rounded-[2.5rem] border border-slate-100 bg-white p-10 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)]"
>
  <div
    class="mb-8 flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-100 bg-slate-50 shadow-inner"
  >
    <svg
      class="h-8 w-8 text-slate-700"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="1.5"
        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
      >
      </path>
    </svg>
  </div>

  <div
    class="mb-10 flex items-center space-x-2 rounded-full bg-emerald-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-700"
  >
    <span class="h-2 w-2 rounded-full bg-emerald-500"></span>
    <span>Protection Active</span>
  </div>

  <h2 class="mb-2 font-medium text-slate-500">Automated release in</h2>
  <div
    class="font-space the-countdown mb-2 text-7xl font-bold tracking-tight text-slate-900"
  >
    168:00:00
  </div>
  <p class="mb-12 text-sm text-slate-400">
    Next check-in required by Oct 24, 2026
  </p>

  <button
    class="bg-brand-600 hover:bg-brand-500 shadow-brand-500/30 mb-8 w-full rounded-2xl py-5 text-lg font-semibold text-white shadow-lg transition-colors active:scale-[0.98]"
  >
    Confirm Status
  </button>

  <div
    class="flex w-full flex-col space-y-4 rounded-xl border border-slate-100 bg-slate-50 p-5"
  >
    <div class="flex items-center justify-between text-sm">
      <span class="flex items-center text-slate-500"><svg
          class="mr-2 h-4 w-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
          >
          </path>
        </svg>
        Emails configured</span>
      <span class="font-medium text-slate-700">3 Recipients</span>
    </div>
    <div class="h-px w-full bg-slate-200"></div>
    <div class="flex items-center justify-between text-sm">
      <span class="flex items-center text-slate-500"><svg
          class="mr-2 h-4 w-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
          >
          </path>
        </svg>
        Webhooks</span>
      <span class="font-medium text-slate-700">1 Endpoint</span>
    </div>
  </div>
</div>
```

---

### Task 4: Implement "The Cipher (Key)"

**Files:**

- Modify: `sentinel-variations.html`

**Step 1: Write the layout** Inject HTML into `<div id="key">`. Extreme
minimalism. Typography focused. A single linear progress line cutting the screen
representing the "keyline".

```html
<!-- Inner content for key -->
<div
  class="relative z-10 flex h-full w-full max-w-5xl flex-col justify-center px-8"
>
  <div class="mb-8 flex items-end justify-between">
    <div>
      <svg
        class="mb-6 h-6 w-6 text-slate-800"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
        >
        </path>
      </svg>
      <h2
        class="text-sm font-semibold uppercase tracking-widest text-slate-400"
      >
        Decryption Timer
      </h2>
    </div>
    <div class="flex items-center text-sm font-medium text-slate-400">
      STATUS: <span class="ml-2 text-emerald-500">SECURE</span>
    </div>
  </div>

  <!-- The massive typography -->
  <div
    class="font-space the-countdown-cipher -ml-2 mb-4 text-[8rem] font-light leading-none tracking-tighter text-slate-900 md:text-[12rem]"
  >
    168:00
  </div>

  <!-- The Keyline (Progress bar that spans wide) -->
  <div class="relative my-8 h-[2px] w-full bg-slate-100">
    <div
      class="absolute left-0 top-0 h-full bg-slate-900"
      style="width: 80%"
    >
    </div>
    <!-- Small indicator dot -->
    <div
      class="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border-2 border-slate-900 bg-white"
      style="left: 80%"
    >
    </div>
  </div>

  <div class="mt-8 flex items-start justify-between">
    <div class="max-w-sm">
      <p class="mb-6 text-sm leading-relaxed text-slate-500">
        Your cryptographic shards remain locked. If this timer expires without a
        check-in, the key will be reassembled and distributed to your designated
        recipients.
      </p>
      <div class="flex space-x-6 text-sm font-medium text-slate-800">
        <div class="flex flex-col">
          <span class="mb-1 text-xs text-slate-400">Payloads</span>3 Active
        </div>
        <div class="flex flex-col">
          <span class="mb-1 text-xs text-slate-400">Last Auth</span>Today, 08:00
        </div>
      </div>
    </div>

    <button
      class="border border-slate-300 bg-white px-8 py-4 text-sm font-semibold uppercase tracking-wide text-slate-800 shadow-sm transition-all hover:border-slate-400 hover:bg-slate-50"
    >
      Authenticate
    </button>
  </div>
</div>
```

---

### Task 5: Add functional JS

**Files:**

- Modify: `sentinel-variations.html`

**Step 1: Write the JS** Add the countdown logic into the script tag.

```html
// Countdown Logic (Simulated 7 days from now) const targetDate = new
Date().getTime() + (7 * 24 * 60 * 60 * 1000); function updateCountdowns() {
const now = new Date().getTime(); const distance = targetDate - now; const days
= Math.floor(distance / (1000 * 60 * 60 * 24)); const hours =
Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)); const minutes
= Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)); const seconds =
Math.floor((distance % (1000 * 60)) / 1000); const totalHours = String(days * 24
+ hours).padStart(3, '0'); const strHours = String(hours).padStart(2, '0');
const strMinutes = String(minutes).padStart(2, '0'); const strSeconds =
String(seconds).padStart(2, '0'); // HHH:MM:SS
document.querySelectorAll('.the-countdown').forEach(el => { el.innerText =
`${totalHours}:${strMinutes}:${strSeconds}`; }); // HHH:MM
document.querySelectorAll('.the-countdown-cipher').forEach(el => { el.innerText
= `${totalHours}:${strMinutes}`; }); // Clean format
document.querySelectorAll('.the-countdown-clean').forEach(el => { el.innerText =
`${days}d ${strHours}h ${strMinutes}m`; }); } updateCountdowns();
setInterval(updateCountdowns, 1000);
```
