<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: PWA implementation plan

- **Plan**: context/changes/pwa-implementation/plan.md
- **Scope**: Phases 1–3 of 3
- **Date**: 2026-08-18
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 2 warnings, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | WARNING |
| Safety & Quality | WARNING |
| Architecture | WARNING |
| Pattern Consistency | WARNING |
| Success Criteria | WARNING |

## Verification evidence

- `npm test -- src/lib/pwa-cache-policy.test.ts` — PASS (1 file, 3 tests)
- `npm run lint` — PASS
- `npm run build` — PASS: generated the PWA worker and passed the artifact verifier.
- `npm run verify` — PASS: 5 files / 39 tests, lint, and production build.
- The first sandboxed build was blocked only by Wrangler's local log/registry write location. The approved reruns completed successfully.

## Findings

### F1 — Handwritten worker replaces the planned generated-worker configuration

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence
- **Location**: astro.config.mjs:17; scripts/generate-pwa-worker.mjs:1
- **Detail**: Phases 1–2 specify a direct `vite-plugin-pwa` generated-worker strategy with the Workbox precache/navigation configuration in `astro.config.mjs`. The implementation retains `VitePWA` only for manifest generation, then adds an unplanned handwritten `sw.js` generator using `workbox-build`. The emitted worker currently follows the desired static-only cache boundary, but the source architecture, review surface, and scope differ materially from the approved plan.
- **Fix A ⭐ Recommended**: Amend the plan with an explicit architectural addendum that approves the custom generator and records its safety invariants.
  - Strength: Preserves an otherwise working implementation and makes the source of truth match the deployed design.
  - Tradeoff: The project keeps a custom service-worker implementation rather than the originally selected plugin-managed worker.
  - Confidence: HIGH — the generator, emitted worker, and verifier are present and the production verification passes.
  - Blind spot: Android/manual lifecycle behavior was not observable from this code review.
- **Fix B**: Reimplement the worker with `vite-plugin-pwa`'s planned generated-worker configuration.
  - Strength: Restores the reviewed design and removes bespoke worker lifecycle code.
  - Tradeoff: Requires reworking the build/output verification and retesting the strict cache boundary.
  - Confidence: MEDIUM — compatible configuration details need confirmation against Astro's Cloudflare output layout.
  - Blind spot: This review did not prototype the replacement configuration.
- **Decision**: PENDING

### F2 — Tested policy is not the generated worker's source of truth

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/lib/pwa-cache-policy.mjs:19; scripts/generate-pwa-worker.mjs:45
- **Detail**: `isNetworkOnlyRequest()` and `usesOfflineFallback()` are unit-tested but never used by the generator; it independently hard-codes request handling. The current worker does network-only navigation with a neutral offline fallback, so this is not an active data leak. However, future changes can regress the worker's cache boundary while its policy tests still pass.
- **Fix**: Make the generator consume one shared request-policy contract and test that contract (or replace the disconnected helpers with deterministic emitted-worker behavior tests).
  - Strength: Binds the security-critical cache policy to the behavior that ships.
  - Tradeoff: Small refactor of the generator/test boundary.
  - Confidence: HIGH — the two separate logic paths are directly observable in source.
  - Blind spot: None significant.
- **Decision**: PENDING

### F3 — Browser-only acceptance is marked complete without repository evidence

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: context/changes/pwa-implementation/plan.md:244
- **Detail**: All Android installation, offline-safety, and automatic-update manual items are checked complete, but the implementation diff cannot evidence those browser/device outcomes. This review acknowledges the recorded acceptance rather than invalidating it.
- **Fix**: Retain the checklist result and record the test environment or deployment URL alongside future manual acceptance entries.
- **Decision**: PENDING
