# FairShare Landing Page Implementation Plan

## Overview

Replace the starter-branded home screen with a responsive FairShare landing page that clearly explains shared family-expense tracking and guides new visitors to sign up while giving signed-in users a direct dashboard path.

## Current State Analysis

The public root route renders `Welcome.astro`, which is still entirely branded as a generic Astro starter. It already provides a cosmic visual treatment, a reusable `Topbar`, and auth CTAs, but its copy and feature cards describe developer tooling instead of FairShare.

Authentication and onboarding destinations already exist: sign up and sign in lead through the current auth flow, and a signed-in user can continue to `/dashboard`. The product currently supports shared expense recording, review, monthly reporting, and balances; it does not support payments, reminders, or custom splits.

## Desired End State

Visitors to `/` see a calm, practical FairShare page with a signup-led hero, truthful benefit messaging, a short explanation of the shared-family workflow, and a CSS-built expense-summary preview. The header adapts to authentication state, and all prominent CTAs point to working product routes on mobile and desktop.

### Key Discoveries:

- `src/pages/index.astro` is a thin public route that can set the product-specific page title while retaining `Layout`.
- `src/components/Welcome.astro` contains all starter-specific homepage content and is the primary replacement target.
- `src/components/Topbar.astro` already distinguishes anonymous and signed-in navigation using `Astro.locals.user`.
- `context/foundation/prd.md` defines the supported product claims: record shared expenses, review them together, see monthly reports, and settle imbalances without handling payments.
- No product imagery or logo assets exist in `public/`, so the preview must be built with HTML/CSS/SVG rather than a static screenshot.

## What We're NOT Doing

- Adding a CMS, analytics, tracking pixels, pricing, or backend APIs.
- Changing authentication, family onboarding, dashboard behavior, or protected-route rules.
- Claiming reminders, payment transfers, custom splits, or dispute resolution features.
- Adding a third-party design, animation, or image dependency.

## Implementation Approach

Rewrite the static Astro homepage using the existing dark cosmic palette, translucent panels, Tailwind breakpoints, and direct `<a>` CTAs. Reuse the auth-aware top bar, build the visual preview from presentational markup, and set explicit FairShare metadata from the index route.

## Phase 1: Public Product Narrative

### Overview

Deliver a complete, responsive FairShare homepage that a new visitor can understand and act on without leaving the existing design system.

### Changes Required:

#### 1. FairShare landing content

**Files**: `src/components/Welcome.astro`

**Intent**: Replace the starter hero and generic developer cards with the product story, signup-led call to action, benefits, workflow, and visual expense-summary preview.

**Contract**: Retain the static Astro rendering model and `Topbar`; use `/auth/signup` as the primary anonymous CTA, `/auth/signin` as secondary, and the dashboard for signed-in visitors. All copy must match supported FairShare functionality.

#### 2. Product-specific page metadata

**Files**: `src/pages/index.astro`

**Intent**: Ensure the public entry point no longer exposes starter-template branding in its document title.

**Contract**: Pass a FairShare-specific title to `Layout`; no route, middleware, or auth behavior changes.

### Success Criteria:

#### Automated Verification:

- `npm test` passes.
- `npm run lint` passes.
- `npm run build` passes.

#### Manual Verification:

- Anonymous visitors see a clear FairShare hero, a Sign up primary CTA, a Sign in secondary CTA, three truthful benefits, a workflow, and a readable expense-summary preview.
- Signed-in visitors see dashboard and sign-out navigation rather than redundant account CTAs.
- The layout, CTA hierarchy, and preview remain readable and usable at mobile and desktop widths.

**Implementation Note**: After completing this phase and automated verification, pause for manual confirmation before committing.

---

## Phase 2: Landing Navigation and Content Polish

### Overview

Verify that the landing page’s navigation and presentation remain aligned with existing authentication routes and the product’s stated scope.

### Changes Required:

#### 1. Auth-aware header refinement

**Files**: `src/components/Topbar.astro` only if verification identifies a clarity or responsive-layout issue

**Intent**: Keep landing navigation clear for both signed-in and anonymous visitors without duplicating auth behavior.

**Contract**: Preserve existing `/auth/signin`, `/auth/signup`, `/dashboard`, and sign-out destinations; source changes are only made when needed to meet the success criteria.

#### 2. Final landing claims review

**Files**: `src/components/Welcome.astro` only if verification identifies unsupported or unclear claims

**Intent**: Ensure the finished page accurately represents today’s product rather than the starter template or unimplemented roadmap items.

**Contract**: Content may describe shared expense tracking, collaboration, monthly reports, and balances, but not money transfers, reminders, or custom-split behavior.

### Success Criteria:

#### Automated Verification:

- `npm test` passes after any polish changes.
- `npm run lint` passes after any polish changes.
- `npm run build` passes after any polish changes.

#### Manual Verification:

- Every visible CTA reaches its intended existing route.
- The page is understandable without starter-template terminology and contains no unsupported product claims.
- Keyboard focus remains visible and the page has no horizontal overflow at mobile and desktop widths.

**Implementation Note**: After completing this phase and automated verification, pause for manual confirmation before committing.

## Testing Strategy

### Unit Tests:

- No new unit-test harness is introduced for this presentational Astro change.
- Preserve the existing unit suite as a regression check.

### Integration Tests:

- No browser E2E framework is introduced; route destinations and responsive behavior are verified manually.

### Manual Testing Steps:

1. Visit `/` while signed out and confirm the hero, product preview, benefits, workflow, and auth CTAs.
2. Follow Sign up and Sign in links and confirm they reach their existing pages.
3. Visit `/` while signed in and confirm dashboard and sign-out navigation are shown.
4. Check the landing page at mobile and desktop widths for visible focus, readable content, and no horizontal scroll.
5. Review all product claims against the dashboard experience.

## Performance Considerations

The page remains server-rendered static Astro markup with CSS/SVG decoration only; it adds no client hydration, network requests, or image payloads.

## Migration Notes

No migration, data update, or deployment sequence is required. Rollback is a component and page-title revert.

## References

- Current root route: `src/pages/index.astro`
- Current starter homepage: `src/components/Welcome.astro`
- Auth-aware navigation: `src/components/Topbar.astro`
- Product scope: `context/foundation/prd.md`
- Existing visual system: `src/styles/global.css`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Public Product Narrative

#### Automated

- [x] 1.1 Replace starter homepage content with the FairShare landing experience
- [x] 1.2 Set the FairShare-specific root page title
- [x] 1.3 Run `npm test`
- [x] 1.4 Run `npm run lint`
- [x] 1.5 Run `npm run build`

#### Manual

- [x] 1.6 Verify the anonymous landing experience, benefits, workflow, and auth CTAs
- [x] 1.7 Verify signed-in navigation and responsive mobile/desktop presentation

### Phase 2: Landing Navigation and Content Polish

#### Automated

- [ ] 2.1 Refine header or landing content only if verification identifies a clarity, route, or scope issue
- [ ] 2.2 Run `npm test` after any polish changes
- [ ] 2.3 Run `npm run lint` after any polish changes
- [ ] 2.4 Run `npm run build` after any polish changes

#### Manual

- [ ] 2.5 Verify every CTA destination, product-claim accuracy, keyboard focus, and responsive overflow
