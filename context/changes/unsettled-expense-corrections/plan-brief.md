# Unsettled Expense Corrections — Plan Brief

> Full plan: `context/changes/unsettled-expense-corrections/plan.md`

## What & Why

Parents need to correct mistakes without silently changing an agreed balance or a locked month. This change adds safe correction and removal of a parent's own unsettled expenses, with every edit returning the item to the other parent's review queue.

## Starting Point

The dashboard already records pending expenses, approves/declines them through guarded Supabase RPCs, and refreshes the expense list and monthly balance in the background. Expenses have no edit/delete commands, and the current decline reason cannot remain on a pending item.

## Desired End State

The payer can edit pending, approved, or declined items while both affected months are unsettled. An edit resets review state to pending and retains the latest prior decline reason for a possible re-decline. The payer can delete only pending or declined items; approved and settled records have no correction actions.

## Key Decisions Made

| Decision | Choice | Why |
| --- | --- | --- |
| Edit statuses | Pending, approved, and declined | Any correction must return to other-parent review. |
| Delete statuses | Own pending and declined only | Preserves approved financial records while allowing declined resolution. |
| Cross-month edits | Allowed when both months are unsettled | Supports genuine corrections without bypassing a lock. |
| Decline context | Retain latest prior reason and pre-fill re-decline | Preserves useful context without a full audit-history system. |
| Settled UI | Hide correction actions | Prevents users attempting an unavailable correction. |
| Interaction model | Background fragment refresh | Preserves scrolling and keeps server-derived balance state authoritative. |

## Scope

**In scope:** guarded edit/delete RPCs; settlement-lock enforcement; prior-decline-reason retention; edit/delete dialogs; background refresh; database and UI lifecycle tests.

**Out of scope:** revision history, deleted-item restore, approved deletion, settlement itself, generic comments, and direct table mutations.

## Architecture / Approach

`Edit/Delete dialog → authenticated Astro route → server normalizer/wrapper → SECURITY DEFINER RPC → refreshed dashboard fragments`. Phase 1 ships the edit migration; Phase 2 adds deletion in its own forward-only migration. Each RPC locks the family and expense, derives authority from `auth.uid()`, checks settlement state, and changes only allowed fields.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Edit and re-review | Safe edits, prior decline context, cross-month refresh | Incorrect reset or settled-month bypass |
| 2. Delete | Safe pending/declined deletion with confirmation | Removing an approved/other-parent item |
| 3. Lifecycle verification | Full authorization and responsive workflow proof | Regressions across status transitions |

**Prerequisites:** S-02 approved expense balance is implemented.

**Estimated effort:** ~3–4 sessions across 3 phases.

## Open Risks & Assumptions

- Future settlement commands must use the same family-row locking protocol as corrections.
- No settlement UI exists yet; this change treats a missing or `open` settlement row as editable and a `settled` row as locked.

## Success Criteria (Summary)

- Only the payer can edit their own unsettled expense and it always re-enters review as pending.
- Only own pending/declined expenses can be deleted; no correction action appears for approved or settled entries.
- All mutations preserve exact balance behavior and refresh the visible month without a full-page reload.
