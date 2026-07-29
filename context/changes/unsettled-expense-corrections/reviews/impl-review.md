# Implementation Review: Unsettled expense corrections

**Reviewed:** 2026-07-29  
**Scope:** completed Phase 1 (edit/re-review) and Phase 2 (delete). Phase 3 remains outside this review because its manual checks are not yet complete.  
**Sources:** [plan](../plan.md), [roadmap](../../../foundation/roadmap.md), [tech stack](../../../foundation/tech-stack.md), [lessons](../../../foundation/lessons.md)

## Verification

| Check | Result |
| --- | --- |
| `npx supabase test db` | PASS — 91 tests |
| `npm test` | PASS — 17 tests |
| `npm run lint` | PASS |
| `npm run build` | PASS |

The implementation matches the completed plan phases: the `update_expense` and `delete_expense` RPCs enforce caller, family, ownership, status, and settlement constraints; API routes follow the established authenticated RPC boundary; and edit/delete UI operations refresh the affected fragments in the background rather than navigating the full page. The pgTAP coverage exercises the intended authorization and state boundaries.

## Findings

### F1 — Declined expenses no longer require an active decline reason

- **Severity:** WARNING
- **Impact:** Low
- **Dimension:** Safety & Quality — data integrity
- **Location:** `supabase/migrations/20260729120000_unsettled_expense_corrections.sql:5-16`

The replacement `expenses_decline_reasons_are_valid` constraint permits `status = 'declined'` with `decline_reason IS NULL`. The previous constraint required a non-empty, trimmed active decline reason for declined expenses. Although the current `decline_expense` RPC still validates the reason, the database invariant is now weaker for future SQL paths or privileged writes.

**Recommended fix:** require a non-empty, trimmed, maximum-500-character `decline_reason` whenever the status is `declined`, while keeping `previous_decline_reason` independently nullable and validated when present.

**Disposition:** Accepted — no fix planned for this change.

### F2 — Roadmap status has not caught up with the active change

- **Severity:** OBSERVATION
- **Impact:** Low
- **Dimension:** Scope discipline
- **Location:** `context/foundation/roadmap.md:100-111`

S-03 is marked `proposed`, while the linked change has implemented Phases 1 and 2 and is in implementation review. Update the roadmap status when Phase 3's manual gate is completed and the slice is ready to close, so planning status remains an accurate hand-off for the next slice.

**Disposition:** Accepted — no roadmap update planned at this time.

## Decision

**APPROVED WITH ACCEPTED RISKS.** The completed Phase 1 and 2 work is aligned with the plan, roadmap outcome, stack conventions, and the background-submission lesson. F1 and F2 are explicitly accepted without follow-up work. Phase 3 still needs its planned manual verification and is not approved by this review.
