# Keyfate UI Design Explorations

## Overview

Keyfate (a secure digital dead man's switch) requires a UI design that
accurately conveys its ethos: security, urgency, trust, and failsafe protection.
This document outlines six distinct aesthetic approaches to the core "dashboard"
interaction where the user sees their switch status and checks in.

## Architecture

- **Format:** A single standalone HTML file (`designs.html`) containing 6 tabbed
  views.
- **Styling:** Tailwind CSS via CDN.
- **Interactivity:** Vanilla JS to handle tab switching and simple animations
  (like countdown timers).

## The Six Design Concepts

1. **The Vault (Brutalist/Hardware)**
   - _Ethos:_ Unbreakable trust, physical security.
   - _Visuals:_ Heavy typography (monospace), thick borders, brutalist concrete
     colors (greys, blacks, off-whites), mimicking a massive physical toggle
     switch or vault door.
2. **The Terminal (Cyberpunk/Hacker)**
   - _Ethos:_ Stealth, control, programmatic precision.
   - _Visuals:_ Black background, bright green or amber text, scanlines, raw
     data readouts, CLI-like interface, and a countdown running in milliseconds.
3. **The Lifeline (Minimalist/Medical)**
   - _Ethos:_ Care, monitoring, preservation of life.
   - _Visuals:_ Clean white backgrounds, soft reds, pulse animations, and a
     heart-monitor-like circular progress ring. Focus on clarity and calm.
4. **The Artifact (Premium/Cryptographic)**
   - _Ethos:_ High-value assets, secret sharing, cryptography.
   - _Visuals:_ Dark mode, subtle gold/bronze accents, glassmorphism, intricate
     geometric backgrounds representing encryption and keys.
5. **The Sentinel (Modern SaaS)**
   - _Ethos:_ Clarity, analytics, modern cloud security.
   - _Visuals:_ Sleek dashboard UI, Shadcn-inspired but elevated. Blue/purple
     glows, clean metrics cards, very structured and professional.
6. **The Panic Room (High-Alert)**
   - _Ethos:_ Absolute urgency, critical warnings.
   - _Visuals:_ High contrast red/black, warning stripes, a massive pulsating "I
     AM ALIVE" button. Stark and utilitarian.

## Execution Plan

A single HTML artifact will be created at the root or within
`frontend-svelte/static` called `keyfate-design-explorations.html`. It will use
inline Tailwind and standard HTML structure to present these six themes.

## Iteration 2: Sentinel + Lifeline Minimalism (The Owl, Shield, Key)

Based on feedback, the user preferred the professional aesthetics of "The Sentinel" but disliked the generic "card" dashboard layout. They appreciated the single-focal-point minimalism of "The Lifeline" and want to align with the brand motif: Owl, Shield, and Key.

We will create `sentinel-variations.html` with three interpretations:

1.  **The Vigil's Eye (Owl)**
    *   *Concept:* Continual observation and readiness.
    *   *Visuals:* A single, massive circular progress ring (combining Lifeline's circle with Sentinel's professional blues/slates). Data points float elegantly around or below the ring without bounding boxes (no cards).
2.  **The Aegis (Shield)**
    *   *Concept:* Absolute protection and safety.
    *   *Visuals:* A single, gently curved central column/monolith. Instead of grid cards, everything is contained within one highly refined, elevated container (similar to modern Apple UI or heavily refined Shadcn).
3.  **The Cipher (Key)**
    *   *Concept:* Access, cryptography, and stark truth.
    *   *Visuals:* Extreme, typography-driven minimalism. A massive countdown number dominates the screen. A single, thin, linear progress bar acts as a "keyline" cutting across the layout. Status text is small, precise, and unboxed.
