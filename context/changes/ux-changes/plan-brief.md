# UX Changes — Plan Brief

> Full plan: `context/changes/ux-changes/plan.md`

## What & Why

This change makes routine expense and dashboard actions clearer and more
trustworthy. It adds parent display names, fixes a mobile action-layout failure,
labels decline reasons, removes a non-actionable current-month settlement CTA,
and aligns desktop navigation controls.

## Starting Point

Expenses know their payer through a family membership but memberships have no
name. The current dashboard already identifies why the current month cannot be
settled, but still renders its disabled action; approval errors can stretch the
Decline button in a mobile action row.

## Desired End State

Parents complete and can edit a 5–15-character display name that appears below
their email and on every expense they created. Expense feedback remains legible
at mobile widths, declined reasons are unambiguous, and dashboard actions match
what is currently possible.

## Key Decisions Made

| Decision | Choice | Why |
| --- | --- | --- |
| Identity scope | `family_members.display_name` | It keeps names inside the existing family RLS boundary. |
| Name collection | Required for new and existing users | New users enter it at sign-up; old users complete it before expenses load. |
| Name rendering | Current name on all expense cards | It makes creator identity clear without duplicating historic data. |
| Settlement scope | Dashboard current month only | Historical report behavior remains unchanged. |
| Approval feedback | Error below both action buttons | It preserves normal control size and a clear relationship to the action set. |

## Scope

**In scope:** family display names, creator labels, name completion/editing,
expense-card feedback, dashboard settlement CTA, desktop navigation widths.

**Out of scope:** global profiles, parent emails on cards, settlement-rule
changes, and historical-report CTA changes.

## Architecture / Approach

A forward-only migration adds a nullable display name to the existing
membership. Controlled RPCs create or update names, while the app gates
pre-existing unnamed members. The workspace retrieves the payer membership name
alongside each expense; presentation refinements stay in the existing Astro
components.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Display names | Safe identity data, profile flow, and creator labels | Existing-user completion and RLS integrity |
| 2. Expense feedback | Stable error layout and labelled reasons | Mobile layout regression |
| 3. Dashboard actions | Honest current-month state and full-width navigation | Preserving historical/mobile behavior |

**Prerequisites:** Local Supabase stack for migration/RLS tests and two test
accounts for manual family verification.
**Estimated effort:** ~2–3 sessions across three phases.

## Open Risks & Assumptions

- Existing unnamed users must complete a name before using expenses.
- A name change intentionally relabels historic cards with the current name.

## Success Criteria (Summary)

- Family names remain private to co-parents and are present on all expense cards.
- Mobile review errors do not resize either action button, and decline reasons
  are explicitly labelled.
- The current dashboard month does not offer settlement; desktop navigation
  controls fill the sidebar.
