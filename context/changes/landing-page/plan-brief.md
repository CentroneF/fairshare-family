# FairShare Landing Page — Plan Brief

> Full plan: `context/changes/landing-page/plan.md`

## What & Why

Replace the generic starter homepage with a calm, practical FairShare entry page. It should explain shared child-expense coordination accurately and guide new visitors to sign up while serving existing users with a dashboard path.

## Starting Point

The root route currently renders a starter-branded cosmic hero and developer-tooling feature cards. The app already has reusable auth-aware navigation and working sign-up, sign-in, and dashboard routes.

## Desired End State

The homepage presents FairShare’s supported workflow—track, review, and understand monthly family expenses—with clear CTAs and a CSS-built product preview. It is responsive, accessible, and free of unsupported claims.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Primary conversion | Sign up first | Best path for a public product homepage. | Plan |
| Signed-in navigation | Dashboard and sign out | Matches existing authenticated routes. | Plan |
| Content depth | Hero, benefits, workflow, preview | Explains value without a long marketing page. | Plan |
| Visual direction | CSS-built expense summary | No suitable product imagery exists. | Plan |
| Messaging | Calm, practical family coordination | Matches the product’s shared-expense purpose. | Plan |

## Scope

**In scope:** the public homepage, its title, static responsive presentation, and navigation/content polish if verification needs it.

**Out of scope:** auth/backend changes, new dependencies, marketing integrations, pricing, payments, reminders, and custom splits.

## Architecture / Approach

Static Astro markup in `Welcome.astro` uses the existing Tailwind cosmic/glass style and `Topbar` session-aware navigation. The root route supplies the product title; no client hydration or data calls are introduced.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Public Product Narrative | Complete responsive product landing page | Unsupported or unclear product claims |
| 2. Landing Navigation and Content Polish | Final route, accessibility, and copy verification | Small header/layout adjustments after manual review |

**Prerequisites:** Existing auth routes remain available.
**Estimated effort:** One implementation session plus manual verification.

## Open Risks & Assumptions

- The page uses a CSS-built preview because no product screenshots or brand assets are available.
- Manual responsive and authentication-state checks are required because no browser test framework exists.

## Success Criteria (Summary)

- Visitors understand what FairShare does and can reach the correct auth flow.
- The page works cleanly for anonymous and signed-in users at mobile and desktop widths.
- The page remains static, fast, and truthful about current functionality.
