---
date: 2026-08-18T16:14:50+02:00
researcher: Codex
git_commit: 9563b526527e2c50cbc4cd8410000b2e1ecf4d23
branch: main
repository: CentroneF/fairshare-family
topic: "Based on prd.md, is there anything about recurring expenses?"
tags: [research, codebase, expenses, recurrence, scheduling]
status: complete
last_updated: 2026-08-18
last_updated_by: Codex
---

# Research: Recurring expenses in the PRD

**Date**: 2026-08-18T16:14:50+02:00
**Researcher**: Codex
**Git Commit**: 9563b526527e2c50cbc4cd8410000b2e1ecf4d23
**Branch**: main
**Repository**: CentroneF/fairshare-family

## Research Question

Based on `context/foundation/prd.md`, is there anything about recurring expenses?

## Summary

Yes. The PRD explicitly includes recurring monthly expenses as **FR-010**, a nice-to-have requirement: co-parents can configure them, but **every monthly occurrence must receive fresh approval from the other parent**. This is deliberately not implemented yet: the roadmap parks it to prioritize the one-off expense and balance MVP.

The current expense lifecycle is a suitable foundation because new expenses begin in `pending` status and existing approval rules require the other active parent. However, no recurrence template, occurrence ledger, background scheduler, or management UI exists.

## Detailed Findings

### Product requirement and scope status

- The PRD's Secondary success criteria say parents can configure recurring monthly expenses. [PRD](https://github.com/CentroneF/fairshare-family/blob/9563b526527e2c50cbc4cd8410000b2e1ecf4d23/context/foundation/prd.md#L34-L36)
- FR-010 defines monthly recurrence and requires a fresh other-parent approval for every occurrence; it explicitly identifies scheduling and repeated approval as the scope tradeoff. [PRD](https://github.com/CentroneF/fairshare-family/blob/9563b526527e2c50cbc4cd8410000b2e1ecf4d23/context/foundation/prd.md#L87-L88)
- The roadmap intentionally parks FR-010 as a nice-to-have until the one-off approval and balance path is complete. [Roadmap](https://github.com/CentroneF/fairshare-family/blob/9563b526527e2c50cbc4cd8410000b2e1ecf4d23/context/foundation/roadmap.md#L154-L160)

### Existing expense lifecycle

- `expenses` represents one-off items only: it has no recurrence/template/source-occurrence fields. [financial rules migration](https://github.com/CentroneF/fairshare-family/blob/9563b526527e2c50cbc4cd8410000b2e1ecf4d23/supabase/migrations/20260717160000_financial_rules_foundation.sql#L32-L63)
- The creation RPC inserts each expense as pending, and approval is restricted to the other active parent. This already meets FR-010's approval invariant if generated occurrences use the same lifecycle. [creation and approval commands](https://github.com/CentroneF/fairshare-family/blob/9563b526527e2c50cbc4cd8410000b2e1ecf4d23/supabase/migrations/20260729170000_joint_monthly_settlement.sql#L87-L131)
- The UI and API accept a manually entered date for a one-off expense; neither exposes a frequency or template-management control. [create API](https://github.com/CentroneF/fairshare-family/blob/9563b526527e2c50cbc4cd8410000b2e1ecf4d23/src/pages/api/expenses/create.ts#L20-L34), [expense form](https://github.com/CentroneF/fairshare-family/blob/9563b526527e2c50cbc4cd8410000b2e1ecf4d23/src/components/expenses/CreateExpenseForm.astro#L37-L87)

### Scheduling and financial-safety implications

- No scheduler is configured in `wrangler.jsonc`, and the repository has no recurrence worker or database scheduling function. [Wrangler configuration](https://github.com/CentroneF/fairshare-family/blob/9563b526527e2c50cbc4cd8410000b2e1ecf4d23/wrangler.jsonc#L1-L16)
- The infrastructure decision record already recommends a UTC Cloudflare Cron trigger calling an idempotent Supabase RPC, backed by a unique recurrence/month occurrence constraint. The cron job should only materialize occurrences, with retry/idempotency and missed-run monitoring designed explicitly. `context/foundation/infrastructure.md:54,83-84,94`.
- A generated occurrence must respect confirmation-locked and settled months; the existing creation/approval commands reject changes in those states. [settlement guard](https://github.com/CentroneF/fairshare-family/blob/9563b526527e2c50cbc4cd8410000b2e1ecf4d23/supabase/migrations/20260729170000_joint_monthly_settlement.sql#L110-L120)

## Code References

- `context/foundation/prd.md:34-36` — recurring expenses are a Secondary outcome.
- `context/foundation/prd.md:87-88` — FR-010 and the fresh-approval rule.
- `context/foundation/roadmap.md:154-160` — explicit parked/deferred status.
- `supabase/migrations/20260717160000_financial_rules_foundation.sql:32-63` — current one-off expense schema.
- `supabase/migrations/20260729170000_joint_monthly_settlement.sql:87-131` — validated pending-expense creation.
- `supabase/migrations/20260729180000_fix_settlement_review_commands.sql:11-33` — other-parent approval enforcement.
- `src/pages/api/expenses/create.ts:20-34` — one-off creation HTTP boundary.
- `src/components/expenses/CreateExpenseForm.astro:37-87` — one-off form surface.
- `wrangler.jsonc:1-16` — no Cloudflare scheduled trigger.

## Architecture Insights

Recurring expenses should be treated as a new template-and-occurrence subsystem, not as a flag on an existing approved expense. The safest shape is a family-owned recurrence template plus a unique monthly occurrence record that materializes a normal pending `expenses` row. That preserves the established review, balance, correction, and settlement rules without creating an approval bypass.

The planner will need to decide template lifecycle (create/edit/pause/delete), which monthly date rule applies, whether missed months are backfilled, and how materialization behaves when a report is confirmation-locked or settled. The scheduler and idempotency boundary are essential rather than incidental infrastructure.

## Historical Context

- `context/foundation/shape-notes.md:76-78,129-130` — original shaping retained recurrence but required each occurrence to be reviewed.
- `context/foundation/infrastructure.md:54,83-84,94` — documented scheduler/idempotency direction.
- `context/domain/01-domain-distillation.md:42,75` — recurrence is an acknowledged, intentional code gap.
- Financial and settlement changes under `context/archive/` consistently excluded recurrence rather than silently omitting it.

## Related Research

- `context/changes/pwa-implementation/research.md` — unrelated PWA research; no recurrence implementation work exists in active changes.

## Open Questions

- Which recurrence cadence is required beyond monthly (only calendar-monthly is specified today)?
- Should the scheduler backfill a missed month, and how should it surface a skipped occurrence when that month is locked?
- Can a template be edited after occurrences exist, and do edits apply only prospectively?
- Which service authorization and operational monitoring path will protect the scheduled RPC in production?
