# PWA implementation plan

## Overview

Make FairShare Family installable as an Android PWA while preserving the app's authenticated, server-rendered data boundary. The implementation adds branded PWA assets and a custom install control, then provides a neutral offline page and automatic service-worker updates without caching financial pages or API data.

## Current State Analysis

The Astro app is server-rendered through the Cloudflare adapter. `src/layouts/Layout.astro` contains the shared document head but has no manifest or mobile metadata. There is no service worker, registration, manifest, install icon set, or PWA build dependency.

Cloudflare serves the `dist` directory as same-origin Worker assets, so generated PWA artifacts can be deployed without changing `wrangler.jsonc`. The app protects user-specific SSR routes in `src/middleware.ts`; service-worker behavior must never cache HTML navigations, auth traffic, Supabase traffic, or `/api/**` responses.

## Desired End State

Users on Chrome for Android can install FairShare Family through an in-app install button when the browser makes installation available. The installed app launches at `/` in standalone display mode and has a dedicated FairShare icon.

When the device is offline, document navigations show a neutral offline page rather than stale account content. New PWA versions activate automatically; static build resources are precached, while all personalized pages and server/API traffic always use the network.

### Key Discoveries:

- `src/layouts/Layout.astro:13-20` is the universal place for manifest, theme, and mobile head metadata.
- `astro.config.mjs:13-21` is the Vite plugin boundary; use direct `vite-plugin-pwa`, not the Astro wrapper, because the project runs Astro 6.
- `wrangler.jsonc:8-12` serves generated `dist` assets at the same origin and needs no configuration change.
- `src/middleware.ts:6-25` authenticates every request and guards dashboard, reports, and expense routes; caching their HTML is unsafe.
- `npm run verify` already ends with the production build and is the appropriate deterministic PWA-output gate.

## What We're NOT Doing

- Offline access to past dashboard, reports, or expenses.
- Offline expense writes, request queues, background sync, or conflict resolution.
- Caching API, authentication, Supabase, or SSR document responses.
- Push notifications, iOS-specific installation work, native applications, or a Wrangler runtime rewrite.
- A user-controlled refresh prompt; service-worker updates activate automatically by product decision.

## Implementation Approach

Use `vite-plugin-pwa` with the generated-worker strategy. Define the manifest and a restricted static-asset precache in `astro.config.mjs`, add explicit shared-head metadata and registration to the layout, and place generated FairShare icons in `public/`. The worker must contain no runtime cache rules; the only navigation fallback is a new static, user-neutral offline route.

The install button is a client-side React component that listens for the browser's `beforeinstallprompt` event, remains hidden when the prompt is unavailable or the app is already installed, and calls the supplied native prompt on user action. Automatic updates use the PWA registration mode chosen by the product decision.

## Critical Implementation Details

Automatic activation/reload can interrupt an in-progress expense form. This is explicitly requested, so do not add a refresh-confirmation UI; keep the registration isolated and ensure it does not alter existing form submission behavior. The offline fallback must be static and never render user or session data.

## Phase 1: Installable FairShare app shell

### Overview

Deliver a branded, installable PWA with a visible install action when Chrome exposes the native prompt. This phase is manually verifiable on Android before adding offline behavior.

### Changes Required:

#### 1. PWA dependency and build configuration

**File**: `package.json`, `package-lock.json`, `astro.config.mjs`

**Intent**: Add the direct Vite PWA plugin and configure a generated worker plus a FairShare manifest compatible with the Astro 6/Vite 7 build.

**Contract**: `vite-plugin-pwa` is a development dependency and `VitePWA(...)` is added to the existing `vite.plugins` array. The manifest uses `FairShare Family` / `FairShare`, root `start_url` and `scope`, `standalone` display, product theme/background colors, and references the new icon assets. The worker precache glob accepts only immutable static resource types and excludes Worker entry files, routes files, maps, and HTML.

#### 2. FairShare PWA icon assets

**Files**: `public/pwa-icon-192.png`, `public/pwa-icon-512.png`, `public/pwa-icon-512-maskable.png`

**Intent**: Create original, recognizable FairShare Family installation icons rather than scaling the starter favicon.

**Contract**: Supply valid PNG assets at 192×192, 512×512, and 512×512 maskable sizes. The maskable source keeps the primary mark inside the safe area; the manifest declares correct sizes and purpose values.

#### 3. Shared metadata and native install control

**Files**: `src/layouts/Layout.astro`, `src/components/pwa/InstallAppButton.tsx`, `src/components/pwa/pwa-registration.ts`

**Intent**: Expose the manifest and product metadata on every page, register the generated worker in the browser, and make installation discoverable without showing an unusable control.

**Contract**: The layout explicitly links `/manifest.webmanifest`, sets theme/mobile metadata and icon references, and loads only the PWA client registration in the browser. `InstallAppButton` is placed in an existing shared visible navigation/shell location, appears only while a deferred native install prompt is available, calls that prompt from its user action, and hides after installation or prompt dismissal. It must be keyboard accessible and have an accessible name.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes with the new Astro/React/client modules.
- `npm run build` completes and emits the manifest, service worker, and all declared icon files.

#### Manual Verification:

- On Chrome Android, a public visit exposes the FairShare install action when browser eligibility is met; selecting it opens the native prompt.
- After installation, launching the app opens FairShare Family in standalone display mode at `/` with the new app icon.
- The install control is not displayed when the native prompt is unavailable or after installation.

**Implementation Note**: After completing this phase and automated verification, pause for human confirmation of Android install behavior before proceeding.

---

## Phase 2: Safe offline fallback and automatic updates

### Overview

Add the requested offline experience while maintaining a strict no-personalized-data cache boundary and enabling automatic delivery of new application versions.

### Changes Required:

#### 1. Neutral offline document

**File**: `src/pages/offline.astro`

**Intent**: Give users a clear, branded explanation when a document navigation cannot reach the network, without implying that their financial data is available offline.

**Contract**: The route is static/user-neutral, contains no Supabase reads or protected content, explains that a connection is needed, and gives a retry/navigation action appropriate for the existing UI language and styles.

#### 2. Worker navigation and update policy

**File**: `astro.config.mjs`, `src/components/pwa/pwa-registration.ts`

**Intent**: Route failed document requests to the neutral offline document and ensure new workers become active automatically, while keeping all user-specific traffic network-only.

**Contract**: Generated Workbox configuration has no `runtimeCaching` rules and no HTML/API precache. Its navigation fallback may serve only the offline document on a failed navigation; `/api/**`, auth routes, Supabase requests, POST/PUT/PATCH/DELETE requests, and normal SSR HTML never enter Cache Storage. Registration uses the automatic-update mode and does not show a refresh prompt.

### Success Criteria:

#### Automated Verification:

- The focused PWA policy checks confirm the generated configuration has no runtime cache rules and declares only the neutral offline navigation fallback.
- `npm run build` completes with the offline document and generated worker assets.

#### Manual Verification:

- After a successful public visit, disabling connectivity and navigating to a document route presents the neutral offline page rather than stale financial or authentication content.
- With connectivity disabled, dashboard/report/expense data and API responses are not displayed from Cache Storage.
- Releasing a changed build activates the updated worker automatically on an eligible open client; the app continues to load normally after activation.

**Implementation Note**: After completing this phase and automated verification, pause for human confirmation of offline and automatic-update behavior before proceeding.

---

## Phase 3: Deterministic PWA verification

### Overview

Make missing or malformed PWA output fail the existing verification gate, then capture the browser-only manual acceptance path for Android.

### Changes Required:

#### 1. Build-output verifier

**File**: `scripts/verify-pwa-build.mjs`, `package.json`

**Intent**: Check the deployed artifact contract instead of relying on generated Workbox internals or a developer inspecting `dist` manually.

**Contract**: The verifier runs after `astro build` and inspects Cloudflare's `dist/client` output. It parses the web manifest; validates the resolved name, short name, root start URL/scope, standalone display, declared icons, and corresponding icon files; confirms a root service worker exists; confirms emitted document HTML links the manifest and theme color; and rejects generated worker output that contains a runtime cache configuration or an unexpected document/API precache. The `build` script invokes it so existing `npm run verify` and CI enforce it.

#### 2. PWA policy tests and acceptance documentation

**Files**: `src/lib/pwa-cache-policy.ts`, `src/lib/pwa-cache-policy.test.ts`, `context/changes/pwa-implementation/plan.md`

**Intent**: Keep the security-critical cache choices readable and unit-testable, while reserving real browser installation behavior for the manual Android acceptance step.

**Contract**: Extract only the app-owned list/rules used to build the PWA configuration into a pure module so Vitest can assert static-only precache and excluded request classes. Do not parse hashed Workbox implementation output in unit tests. The plan's manual steps remain the canonical Android/worker acceptance checklist; browser automation is deferred to a future `/10x-e2e` change if it becomes necessary.

### Success Criteria:

#### Automated Verification:

- `npm test -- src/lib/pwa-cache-policy.test.ts` passes for static assets, document navigation fallback, API traffic, auth traffic, and mutation requests.
- `npm run build` fails when the manifest, declared icons, root worker, required head metadata, or cache-policy output is absent or invalid.
- `npm run verify` passes, including the PWA build-output verifier.

#### Manual Verification:

- Follow the Phase 1 Chrome Android installation check and confirm the installed app shows the expected icon and standalone window.
- Follow the Phase 2 offline check and confirm the generic page contains no family, expense, report, or authentication data.
- Confirm an update replaces the current service worker without a user-facing update prompt.

**Implementation Note**: After completing this phase and automated verification, pause for human confirmation that the Android install, offline, and update checks succeeded.

## Testing Strategy

### Unit Tests:

- Test the declarative PWA cache policy: allowed immutable static extensions, offline document navigation fallback, and network-only exclusions for HTML, `/api/**`, auth, Supabase, and mutations.
- Keep tests in `src/**/*.test.ts` so the existing Vitest configuration discovers them.

### Integration Tests:

- Run the build-output verifier as part of `npm run build`, then rely on the existing CI `npm run verify` gate.
- Do not add generated-worker string snapshots or authenticated Playwright tests to this change; they are brittle or require seed state outside current CI.

### Manual Testing Steps:

1. Build and serve the production artifact over HTTPS or an Android-compatible test deployment.
2. In Chrome Android, load `/`, use the custom install action, accept the native prompt, and relaunch the installed app.
3. Confirm the manifest identifies FairShare Family, the installed app is standalone, and the new icon is shown.
4. Load a public page online, disable connectivity, then navigate to a document route and confirm the neutral offline page appears.
5. While offline, attempt dashboard/report/expense navigation and verify no cached user data or API response appears.
6. Deploy a changed build and verify the application updates automatically without displaying a refresh prompt.

## Performance Considerations

Restrict precaching to versioned static resources and small PWA assets so worker installation remains fast and cache growth stays bounded. Never add runtime image/data cache rules until product requirements define stale-data and shared-device behavior.

## Migration Notes

No database migration is required. Rollback consists of deploying the prior build; browsers may retain the previously installed worker until the replacement lifecycle completes, so rollback verification should include a fresh navigation after deployment.

## References

- Research: `context/changes/pwa-implementation/research.md`
- Shared head: `src/layouts/Layout.astro:13-20`
- Vite configuration: `astro.config.mjs:10-22`
- Auth boundary: `src/middleware.ts:6-25`
- Asset deployment: `wrangler.jsonc:8-12`
- Build/test conventions: `package.json:5-14`, `vitest.config.ts:3-7`, `.github/workflows/ci.yml:16-22`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Installable FairShare app shell

#### Automated

- [x] 1.1 Add the PWA build dependency and generated-worker manifest configuration.
- [x] 1.2 Create and connect the FairShare PWA icon set.
- [x] 1.3 Add shared PWA metadata, registration, and browser-gated install control.
- [x] 1.4 Run lint and a production build that emits the manifest, worker, and icons.

#### Manual

- [x] 1.5 Verify Android installation, standalone launch, icon, and install-control visibility.

### Phase 2: Safe offline fallback and automatic updates

#### Automated

- [ ] 2.1 Add the static, neutral offline document and restricted navigation fallback.
- [ ] 2.2 Configure network-only personalized traffic and automatic worker updates.
- [ ] 2.3 Run focused cache-policy checks and a production build.

#### Manual

- [ ] 2.4 Verify offline navigation never displays cached financial or authentication data.
- [ ] 2.5 Verify an updated worker activates automatically without a refresh prompt.

### Phase 3: Deterministic PWA verification

#### Automated

- [ ] 3.1 Add the manifest, icon, worker, metadata, and cache-policy build-output verifier.
- [ ] 3.2 Add focused unit tests for the application-owned cache policy.
- [ ] 3.3 Run `npm run verify` with the PWA verification gate.

#### Manual

- [ ] 3.4 Complete the Android installation, offline-safety, and automatic-update acceptance checklist.
