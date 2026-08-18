# PWA implementation — Plan Brief

> Full plan: `context/changes/pwa-implementation/plan.md`
> Research: `context/changes/pwa-implementation/research.md`

## What & Why

FairShare Family will become an Android-installable PWA, as required by the product definition. The work adds product-ready branding, a discoverable install action, and a safe offline failure experience without treating personal financial data as offline content.

## Starting Point

The current Astro/Cloudflare app has no manifest, worker, PWA icons, registration, or install UI. It server-renders authenticated, user-specific pages, so caching their HTML or API data is unsafe.

## Desired End State

Chrome Android users can choose an in-app install action when the browser allows it, then open FairShare Family as a standalone app with a dedicated icon. When disconnected, the app supplies a generic offline page, while financial pages and APIs remain network-only; updates activate automatically.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| PWA integration | Direct `vite-plugin-pwa` | It supports the project's Astro 6/Vite 7 arrangement without the Astro wrapper peer mismatch. | Research |
| Cache strategy | Static-only precache | Personalized SSR pages and APIs must never be cached. | Research |
| Offline behavior | Generic offline page | Gives a polished failure state without storing financial data. | Plan |
| Updates | Automatic activation | Selected product behavior, with no refresh prompt. | Plan |
| Icon asset | New FairShare icon set | Produces install-ready branding rather than retaining a starter favicon. | Plan |
| Installation UX | Browser-gated custom button | Makes installation discoverable while using the native browser prompt. | Plan |
| Verification | Build gate plus manual Android check | Keeps CI deterministic while validating the real install flow. | Plan |

## Scope

**In scope:**

- PWA manifest, service worker, generated icon set, shared metadata, and custom install button.
- Static-only precache, neutral offline document fallback, automatic worker updates.
- Deterministic build-output verification in the existing CI gate and manual Chrome Android acceptance steps.

**Out of scope:**

- Cached dashboards/reports, offline writes, background sync, push notifications, native apps, and iOS-specific work.

## Architecture / Approach

`vite-plugin-pwa` generates a root worker and manifest during the existing Astro build. The shared layout links the manifest and initializes client-only registration; an install component invokes the browser's deferred native prompt. Workbox precaches only immutable static assets, and failed navigations use a static offline document—never user-specific HTML or APIs.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Installable shell | Manifest, icons, registration, and install button | Browser install eligibility varies by device/context. |
| 2. Safe offline/update | Neutral fallback, static-only cache, automatic updates | Accidental caching of protected responses. |
| 3. Verification | Build gate and Android acceptance checklist | Build output paths may differ from assumptions. |

**Prerequisites:** Node 22/npm dependencies; an HTTPS Android-accessible environment for final installation testing.  
**Estimated effort:** ~2–3 sessions across three manually verifiable phases.

## Open Risks & Assumptions

- Automatic update activation can interrupt active form work; this is an explicit product choice.
- Android's native prompt appears only when the browser considers the app installable; the custom button must remain hidden otherwise.
- No offline data behavior will be added until stale-data and shared-device rules are specified.

## Success Criteria (Summary)

- The production build and CI verification gate fail if PWA artifacts or safe policy settings are missing.
- Chrome Android can install and launch FairShare Family as a standalone app with the new icon.
- Offline navigation shows only a generic page; no financial, authentication, API, or Supabase data is served from Cache Storage.
