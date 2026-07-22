# Approved Expense Balance — Plan Brief

> Full plan: `context/changes/approved-expense-balance/plan.md`

## What & Why

This change delivers the first complete shared-money workflow: parents record an expense, the other parent decides it, and only approved spending changes the family’s monthly balance. It turns the existing family and financial-rule foundations into the product’s first visible financial outcome.

## Starting Point

Families, children, exact PLN expense storage, read-only family RLS, and pure Decimal.js balance rules already exist. Missing pieces are authorized expense commands, a request-scoped data adapter, expense API routes, and the dashboard experience.

## Desired End State

Parents can create current/past dated PLN expenses for a child or N/A, review the other parent’s pending expenses, and see exact approved/pending totals for the selected month. Declined items stay visible with one required, immutable reason but never affect totals or settlement guidance.

## Key Decisions Made

| Decision | Choice | Why |
|---|---|---|
| Delivery shape | Three vertical slices | Each phase leaves a testable user workflow across database, server, and UI. |
| Pre-join creation | Allowed, always pending | Matches FR-006 and lets the creator start tracking immediately. |
| Dates/months | Current or past only | Supports late entry without creating future financial records. |
| Child assignment | Optional; N/A maps to null | Uses the existing nullable `child_id` relationship. |
| Decimal entry | Accept comma or dot | Fits Polish input habits while preserving exact server-side decimal storage. |
| Decline explanation | Required immutable reason, max 500 characters | Provides future review context without adding general comments or disputes. |
| Monthly list | Newest active items, then declined section | Satisfies FR-013 while keeping current work prominent. |

## Scope

**In scope:** pending creation, other-parent approval, required-reason decline, current/past month selection, exact balance, and full database authorization coverage.

**Out of scope:** edits/deletes, settlement, history, recurring expenses, notifications, receipts, categories, generic comments, and future dates.

## Architecture / Approach

The database owns creation and review authorization through authenticated security-definer RPCs. Astro API routes use the current request-scoped client, a typed repository loads one family/month, existing Decimal.js functions derive balances, and the dashboard renders the resulting state. No client mutation or service-role client is introduced.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Record pending expenses | Secure creation, month list, and form | Correct family/child/date authorization |
| 2. Approve into balance | Other-parent review and exact balance | Preventing self/repeat approval |
| 3. Decline and finish month UX | Required reason, accessibility, final flow | Keeping reason immutable and excluded from totals |

**Prerequisites:** completed financial-rules and family-onboarding changes; local Supabase stack for pgTAP verification.
**Estimated effort:** ~3 sessions across 3 phases.

## Open Risks & Assumptions

- The completed financial foundation’s expense schema remains additive and has no production expense data requiring backfill.
- A decline reason is intentionally a narrow exception to the PRD’s general no-comments rule; it must not evolve into discussion threads in this slice.
- The current dashboard remains the only family workspace, so month state must survive all POST redirects.

## Success Criteria (Summary)

- Only the active family parent can create an expense, and only the other active parent can make its final review decision.
- Exact approved/pending totals and the directed 50/50 balance update when an expense is approved.
- Declined expenses keep their required reason, remain visible, and never contribute to financial totals.
