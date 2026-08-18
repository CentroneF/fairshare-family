---
date: 2026-08-18T14:04:37+02:00
researcher: Codex
git_commit: fda6ea3da4de9bf56c4e05472cdfbeca9a780215
branch: main
repository: CentroneF/fairshare-family
topic: "I want to make the web app a pwa"
tags: [research, codebase, pwa, astro, cloudflare, service-worker]
status: complete
last_updated: 2026-08-18
last_updated_by: Codex
---

# Research: Make the web app a PWA

**Date**: 2026-08-18T14:04:37+02:00  
**Researcher**: Codex  
**Git Commit**: fda6ea3da4de9bf56c4e05472cdfbeca9a780215  
**Branch**: main  
**Repository**: CentroneF/fairshare-family

## Research Question

I want to make the web app a pwa

## Summary

The app is not currently a Progressive Web App, despite Android-installable PWA support being an explicit MVP requirement. It has no web manifest, service worker, install icons, registration code, or PWA build integration.

The current Astro 6 server-rendered app can support a PWA cleanly: Cloudflare Workers serves the built `dist` directory as same-origin assets, so generated manifest, icons, and a root-scoped service worker can be deployed without a Worker routing change. The PWA must initially be an **installable online app**, rather than an offline-first app. Its authenticated SSR pages and API calls contain user-specific financial data and must never be stored by the service worker; only immutable static assets may be precached.

## Detailed Findings

### Product scope

- Android-installable PWA support is explicitly required alongside responsive behavior in the [PRD](https://github.com/CentroneF/fairshare-family/blob/fda6ea3da4de9bf56c4e05472cdfbeca9a780215/context/foundation/prd.md#L101-L106) and [shape notes](https://github.com/CentroneF/fairshare-family/blob/fda6ea3da4de9bf56c4e05472cdfbeca9a780215/context/foundation/shape-notes.md#L143-L147).
- A native app is explicitly out of scope; Android installation is intended to use the PWA ([PRD](https://github.com/CentroneF/fairshare-family/blob/fda6ea3da4de9bf56c4e05472cdfbeca9a780215/context/foundation/prd.md#L124-L133)).
- No product artifact requires offline reads, offline expense creation, background sync, push notifications, or iOS installation. Those are separate scope decisions, not prerequisites for this MVP requirement.

### Current integration points and missing PWA assets

- The shared [Layout.astro](https://github.com/CentroneF/fairshare-family/blob/fda6ea3da4de9bf56c4e05472cdfbeca9a780215/src/layouts/Layout.astro#L13-L20) contains the universal document head, but currently emits only charset, viewport, favicon, and title. It is the correct location for the manifest link, theme color, and mobile metadata.
- [astro.config.mjs](https://github.com/CentroneF/fairshare-family/blob/fda6ea3da4de9bf56c4e05472cdfbeca9a780215/astro.config.mjs#L10-L22) has React, sitemap, Tailwind, and the Cloudflare adapter, but no PWA/Workbox Vite plugin. This is the natural build configuration point for `vite-plugin-pwa` or an equivalent integration.
- `public/` has a 32×32 favicon only; it lacks a web manifest and the 192px/512px (including maskable) icons Android installation needs. There is no existing global client script to register a worker.
- `package.json` has no PWA dependency, but `npm run verify` already includes the production build, so PWA output verification can join the existing build gate.

### Hosting compatibility

- The Astro app uses server output and the Cloudflare adapter ([astro.config.mjs](https://github.com/CentroneF/fairshare-family/blob/fda6ea3da4de9bf56c4e05472cdfbeca9a780215/astro.config.mjs#L10-L22)).
- Wrangler binds `./dist` as Worker assets ([wrangler.jsonc](https://github.com/CentroneF/fairshare-family/blob/fda6ea3da4de9bf56c4e05472cdfbeca9a780215/wrangler.jsonc#L3-L12)). Manifest, icons, and a generated `sw.js` in that output are therefore available from the same origin and can use root scope. No deployment-runtime blocker was found.
- There are no custom cache headers or asset exclusions today. The plan should make the service worker strategy explicit rather than relying on CDN defaults.

### Authentication and caching boundary

- Each request constructs a Supabase client from request headers/cookies and loads the user ([middleware](https://github.com/CentroneF/fairshare-family/blob/fda6ea3da4de9bf56c4e05472cdfbeca9a780215/src/middleware.ts#L6-L17)); protected URL prefixes redirect unauthenticated visitors to sign-in ([middleware](https://github.com/CentroneF/fairshare-family/blob/fda6ea3da4de9bf56c4e05472cdfbeca9a780215/src/middleware.ts#L19-L25)).
- Dashboard, reports, and expense pages are personalized server-rendered content. Caching navigation HTML, auth responses, or `/api/**` in a service worker can display stale account data or expose data across a shared device/session change.
- The initial worker should precache only hashed/static application assets, the manifest, and icons. It should use NetworkOnly for APIs and SSR navigations; a neutral offline document is optional and must contain no user data. Offline mutation queues and background sync require separate consistency and security design.
- `start_url` should be `/`, not `/dashboard`, because the latter is protected and redirects when no session exists.

### Validation and delivery

- The CI workflow runs `npm ci`, Astro sync, and `npm run verify`, but has no PWA-specific assertion or browser install/offline coverage.
- A first implementation should validate build output (manifest, service-worker, required icons) and service-worker policy. Browser-level checks can later confirm Android-compatible installability and that authenticated pages remain network-only.
- Existing lessons say plans should be vertical and manually verifiable from the frontend; this change should deliver the manifest/install path first, then the safe worker policy and verification.

## Code References

- [src/layouts/Layout.astro:13](https://github.com/CentroneF/fairshare-family/blob/fda6ea3da4de9bf56c4e05472cdfbeca9a780215/src/layouts/Layout.astro#L13) — shared HTML head for PWA metadata.
- [astro.config.mjs:10](https://github.com/CentroneF/fairshare-family/blob/fda6ea3da4de9bf56c4e05472cdfbeca9a780215/astro.config.mjs#L10) — Astro/Vite integration location.
- [wrangler.jsonc:8](https://github.com/CentroneF/fairshare-family/blob/fda6ea3da4de9bf56c4e05472cdfbeca9a780215/wrangler.jsonc#L8) — Cloudflare Worker static asset delivery.
- [src/middleware.ts:4](https://github.com/CentroneF/fairshare-family/blob/fda6ea3da4de9bf56c4e05472cdfbeca9a780215/src/middleware.ts#L4) — protected route policy that prevents a protected PWA start URL.
- [package.json:5](https://github.com/CentroneF/fairshare-family/blob/fda6ea3da4de9bf56c4e05472cdfbeca9a780215/package.json#L5) — existing build and verification scripts.

## Architecture Insights

This is an authenticated, server-rendered web application rather than a static app shell. PWA delivery should be deliberately narrow: installation and resilient delivery of public static resources, while all session-aware HTML and server APIs retain normal network semantics. PWA metadata belongs in the shared layout; service-worker generation belongs in the Vite configuration; portable image assets belong in `public/` or generated build output. This does not require database or domain-model changes.

## Historical Context (from prior changes)

- [context/foundation/roadmap.md](https://github.com/CentroneF/fairshare-family/blob/fda6ea3da4de9bf56c4e05472cdfbeca9a780215/context/foundation/roadmap.md#L30-L37) places PWA support with platform/onboarding delivery rather than the financial domain.
- The family-onboarding plan only verified responsive narrow Android layouts, with no manifest or service-worker work ([archived plan](https://github.com/CentroneF/fairshare-family/blob/fda6ea3da4de9bf56c4e05472cdfbeca9a780215/context/archive/2026-07-20-family-onboarding/plan.md#L159-L165)).
- No prior change, archive artifact, or git history describes a PWA manifest or service-worker design.

## Related Research

No related research artifacts were found.

## Open Questions

- What product name, short name, theme color, and source artwork should the manifest use? The current starter title and favicon are not product-ready PWA branding.
- Should the MVP show a generic offline page for failed navigations, or stay strictly online-only while still supporting installation?
- What update experience is preferred when a new service worker is available: automatic reload, or a visible refresh prompt?
