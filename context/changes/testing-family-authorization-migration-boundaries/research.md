---
date: 2026-08-04T11:00:30+02:00
researcher: Codex
git_commit: e34f8a53059504517a9f8f0bd3c6234bfc77ba11
branch: testing-family-authorization-migration-boundaries
repository: fairshare-family
topic: "Phase 2 family authorization and migration boundaries"
tags: [research, testing, supabase, rls, pgtap, authorization, migrations]
status: complete
last_updated: 2026-08-04
last_updated_by: Codex
---

# Research: Phase 2 family authorization and migration boundaries

**Date**: 2026-08-04T11:00:30+02:00  
**Researcher**: Codex  
**Git Commit**: e34f8a53059504517a9f8f0bd3c6234bfc77ba11  
**Branch**: testing-family-authorization-migration-boundaries  
**Repository**: fairshare-family

## Research Question

Ground rollout Phase 2 from `context/foundation/test-plan.md`: prove that RLS
and migration changes preserve family isolation and valid access for Risks #3
and #6, using the cheapest meaningful layer.

## Summary

The authoritative ownership boundary is the Supabase database, not the Astro
routes. Every core record carries a family identity, forced RLS filters direct
reads to the active parent’s family, and authenticated callers have no direct
table mutation policies. Mutations are `SECURITY DEFINER` RPCs that derive the
caller family from `auth.uid()` and then check a target resource’s family.

Existing pgTAP coverage proves the core posture and several foreign-family
denials, but it is dispersed across foundation and financial lifecycle suites.
The clearest remaining regression gaps are foreign-parent `update_expense` and
`confirm_monthly_settlement` calls, broad direct-read isolation across all
family-owned tables, and explicit unchanged-row postconditions. A focused
pgTAP suite run through `npx supabase test db` is the cheapest real signal;
endpoint mocks and browser tests would duplicate the database contract without
exercising JWT claims, RLS, grants, or final migrations.

## Detailed Findings

### Database ownership and read boundary

- Composite foreign keys tie children, payer/reviewer memberships, expenses,
  and settlements to one family, preventing cross-family reference combinations
  at the schema layer: `supabase/migrations/20260717160000_financial_rules_foundation.sql:23-102`.
- Core tables have RLS both enabled and forced. Their `SELECT` policies call
  `is_active_family_member(family_id)`, which requires the authenticated user
  to be an active parent in the target family: `supabase/migrations/20260717160000_financial_rules_foundation.sql:200-215,241-277`.
- Direct table writes are deliberately unavailable to ordinary authenticated
  callers: only select access is granted after the policies. The baseline suite
  proves foreign expense reads are empty and direct expense insert/update/delete
  is denied: `supabase/tests/financial_rules_foundation.test.sql:25-60`.

### RPC command boundary

- The application’s mutation routes require a session but accept resource UUIDs
  from the request; they rely on database RPCs for ownership enforcement, as
  shown by approve, edit, delete, and settlement handlers:
  `src/pages/api/expenses/approve.ts:5-20`,
  `src/pages/api/expenses/edit.ts:14-36`,
  `src/pages/api/expenses/delete.ts:5-18`, and
  `src/pages/api/settlements/confirm.ts:5-20`.
- The request-scoped client forwards the user session and explicitly avoids a
  service-role client, preserving RLS/user identity:
  `src/middleware.ts:6-17` and `src/lib/supabase.ts:5-27`.
- Current expense command definitions derive the active caller membership, lock
  the caller family where needed, and reject an expense from another family.
  The final approve/decline replacements are in
  `supabase/migrations/20260729180000_fix_settlement_review_commands.sql:11-73`;
  create, update, and delete protections are in
  `supabase/migrations/20260729170000_joint_monthly_settlement.sql:104-130,208-276`.
- The history RPC is also `SECURITY DEFINER`, but independently validates the
  requested family against `auth.uid()` before reading:
  `supabase/migrations/20260729160000_fix_monthly_report_history_query.sql:5-26`.

### Existing integration coverage and gaps

- pgTAP suites use transactional fixtures, switch to the authenticated role,
  and set `request.jwt.claim.sub` for each actor, which exercises the real RLS
  and function behavior: `supabase/tests/financial_rules_foundation.test.sql:1-65`
  and `supabase/tests/family_onboarding.test.sql:5-14`.
- The lifecycle suite already rejects foreign-family create-child, approve,
  decline, delete, and report-history calls, and confirms foreign direct reads
  are empty: `supabase/tests/approved_expense_balance.test.sql:110-113,135-139,627-646`.
- It does not call `update_expense` with a foreign family’s expense ID, and it
  does not call `confirm_monthly_settlement` as a foreign parent. Its baseline
  direct-read assertion is limited to expenses; it does not assert isolation
  for families, memberships, children, and settlements.
- The existing lifecycle file is a large 120-plan suite. A dedicated focused
  pgTAP authorization file will make the ownership contract legible and avoid
  coupling this phase to unrelated financial-state assertions.

### Migration-boundary implications

- The security-critical routines have been repeatedly replaced as capabilities
  grew—foundation, onboarding, expense review/corrections, settlement, then a
  final approve/decline correction. Later `CREATE OR REPLACE` definitions can
  regress family checks or grants while leaving earlier migration files intact.
  Run the test through the complete local migration chain, not against an
  isolated SQL file.
- Current tests validate the final assembled schema rather than an incremental
  upgrade from preserved production-like data. There is no identified data
  backfill contract that justifies a synthetic upgrade fixture in this phase.
  Prefer durable catalog and behavioral invariants; add an upgrade-fixture test
  only when a future migration transforms existing data.

## Recommended Phase-2 Test Matrix

| Protection to prove | Actor and operation | Oracle / postcondition |
|---|---|---|
| Direct RLS family isolation | Family B parent selects Family A’s families, memberships, children, expenses, and settlements | no Family A row visible; Family B’s own fixture remains visible |
| No direct write bypass | Authenticated parent inserts, updates, or deletes a protected domain row | permission denied; target state is unchanged |
| Foreign resource mutation denial | Family B calls approve, decline, update, and delete using a Family A expense ID | `Expense is not available to this family`; Family A row is unchanged |
| Foreign settlement denial | Family B calls settlement confirmation for Family A’s report month | family-availability denial; Family A settlement fields are unchanged |
| Foreign relationship injection denial | Family A creates or updates using Family B’s child ID | rejection; no new row or altered child relation |
| Definer read boundary | Family B requests Family A’s history RPC | family-availability denial / no result; own-family positive control still succeeds |

Use two family fixtures and four authenticated users, changing the local JWT
subject for each case. Keep the expectations independent of implementation
details: assert visible data, denied operation, SQLSTATE/message where stable,
and persisted postconditions. Do not mock auth/RLS internals, mirror policy SQL
in test assertions, or use a route-level session test as proof of ownership.

## Architecture Insights

The app intentionally separates session establishment from authorization:
pages derive a current family from the server-side session, while the database
must still reject a forged, stale, or foreign family/resource identifier. The
same design applies to reads: app helpers pass family IDs into RLS-backed calls,
but RLS or a definer function validates the caller. This makes a database
integration suite the correct cross-cutting contract test.

## Historical Context

- The financial foundation explicitly chose forced RLS, caller-derived family
  identity, no direct authenticated mutations, and pgTAP proof of cross-family
  isolation: `context/archive/2026-07-17-financial-rules-verification/plan.md:32-34,50-62,185-199`.
- The same slice’s implementation review found that early tests only inspected
  RLS configuration rather than authenticated behavior, motivating the later
  authenticated suite: `context/archive/2026-07-17-financial-rules-verification/reviews/impl-review.md:23-34`.
- The onboarding plan requires routes not to trust client-provided family or
  user IDs and retains family authorization inside database RPCs:
  `context/archive/2026-07-20-family-onboarding/plan.md:29-37,97`.
- The prior Phase 1 test rollout deliberately kept the UI advisory and the
  database transaction boundary authoritative; that same cost × signal decision
  applies here: `context/changes/testing-expense-settlement-state-protections/research.md:36-38,62-67`.

## Related Research

- `context/changes/testing-expense-settlement-state-protections/research.md`

## Test-Layer Decision

Use Supabase CLI pgTAP database integration tests. Run `npx supabase test db`
after the local Supabase stack starts. The repository’s `npm test` script runs
Vitest only, so it does not prove RLS/migration behavior. No e2e or AI-native
layer adds cheaper signal for these risks.

## Open Questions

- Should a future migration that backfills or transforms persisted family data
  add an incremental-upgrade fixture to this authorization suite? No current
  migration contract requires it.
- Is a two-session concurrency test needed if the family-lock order changes?
  It is outside this phase because the target risks are ownership/migration
  boundaries and pgTAP’s normal harness is sequential.

## Test-Plan Backport Check

No §2 backport is needed. Research confirms that `supabase/migrations/` and
`supabase/tests/` are valid likelihood evidence, the two risks are concrete,
and the database-integration layer remains the cheapest useful response.
