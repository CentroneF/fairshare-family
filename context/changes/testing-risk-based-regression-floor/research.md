---
date: 2026-08-04T11:55:03+02:00
researcher: Codex
git_commit: b6eac3dd9e00c801f4249e2164ca52fb6ade2f80
branch: testing-risk-based-regression-floor
repository: fairshare-family
topic: "Risk-based regression-floor enforcement for financial and family-authorization tests"
tags: [research, testing, ci, vitest, supabase, quality-gates]
status: complete
last_updated: 2026-08-04
last_updated_by: Codex
---

# Research: Risk-based regression-floor enforcement

**Date**: 2026-08-04T11:55:03+02:00  
**Researcher**: Codex  
**Git Commit**: b6eac3dd9e00c801f4249e2164ca52fb6ade2f80  
**Branch**: testing-risk-based-regression-floor  
**Repository**: fairshare-family

## Research Question

Ground rollout Phase 3 of `context/foundation/test-plan.md`: make the shipped
financial-state and family-authorization test patterns runnable through reliable
commands, determine whether they are automatically enforced, and avoid extra
browser, snapshot, or AI-native layers without additional signal.

## Summary

The repository already has the two required regression seams. Vitest supplies
fast deterministic coverage for financial rules, while transactional pgTAP
tests exercise migrations, grants, RLS, RPCs, and persisted-state assertions.
The gap is enforcement and discoverability, not missing test types.

`npm test`, lint, and build are runnable with the project dependencies, but the
only GitHub workflow is manual-only and runs lint/build without unit tests. The
database suite needs Docker and a locally started Supabase stack, so it should
remain an explicit migration/RLS gate unless this change demonstrates a stable,
budget-acceptable CI setup. A browser, snapshot, or AI-native layer would not
add cheaper signal for these risks.

## Detailed Findings

### Runnable deterministic JavaScript checks

- `npm test` runs `vitest run`; lint runs `eslint .`; build runs `astro build`
  (`package.json:5-13`). Vitest and the Supabase CLI are project dev
  dependencies (`package.json:54-57`). There is no aggregate verification
  script or dedicated database-test script.
- Vitest uses conventional test discovery rather than a repository-specific
  config. Financial state semantics already have independent table-style
  examples in `src/lib/financial-rules.test.ts:33-100`; app-level amount/input
  handling has examples in `src/lib/expense-balance.test.ts:20-46`.
- The existing cookbook correctly directs focused/full Vitest execution and
  database execution after the local stack starts
  (`context/foundation/test-plan.md:95-98`, `:117-119`). Its cross-cutting
  running section is still explicitly TBD (`:121-123`).

### Database integration is the authoritative authorization signal

- The pgTAP authorization suite creates two isolated families and changes the
  authenticated JWT subject within a transaction; it tests visibility,
  direct-write denial, foreign RPC handling, and rollback
  (`supabase/tests/family_authorization_boundaries.test.sql:1-113`).
- The financial lifecycle suite provides authoritative rejection plus
  persisted-state patterns (`supabase/tests/approved_expense_balance.test.sql:1-62`,
  `:391-419`). These verify the real SQL/RLS/RPC boundary that mocks cannot
  represent.
- Local Supabase is configured for migrations and seed data
  (`supabase/config.toml:53-65`), but DB testing requires Docker, environment
  setup, and `npx supabase start` (`README.md:77-109`). Repository rules require
  `npx supabase test db` after migration/RLS changes and prohibit routine
  `supabase db reset` (`AGENTS.md:20-24`).

### The enforcement gap is real

- The only workflow has `workflow_dispatch` as its sole trigger
  (`.github/workflows/ci.yml:1-4`). It installs dependencies, synchronizes
  Astro, runs lint, and builds (`.github/workflows/ci.yml:10-21`), but runs
  neither `npm test` nor `npx supabase test db`.
- The pre-commit hook runs only `lint-staged` (`.husky/pre-commit:1`). Its
  configured actions are formatting/autofix tasks, not unit or database tests
  (`package.json:63-70`). Tests are therefore a documented expectation rather
  than mechanically enforced.
- `README.md:169-171` and `CLAUDE.md:52-54` claim lint/build run on every push
  and pull request, which conflicts with the actual manual trigger. The README
  also omits `npm test` from its available scripts (`README.md:50-57`).

### Policy and historical constraints

- The project rules require `npm test`, lint, and build before a pull request;
  database tests are required when migrations or RLS change (`AGENTS.md:20-24`).
  They also prohibit creating CI/CD pipelines from scratch and position costly
  integration checks as potentially ad hoc (`AGENTS.md:120-140`).
- Both completed rollout phases successfully used the four command checks:
  financial state (`context/changes/testing-expense-settlement-state-protections/plan.md:130-135`)
  and family authorization (`context/changes/testing-family-authorization-migration-boundaries/plan.md:132-136`).
  Neither change wired them into CI.
- The prior financial-rules decision permits a DB CI job only if local Supabase
  starts deterministically without hosted secrets; otherwise the explicit local
  command is preferable to a flaky job
  (`context/archive/2026-07-17-financial-rules-verification/plan.md:193-200`).

## Recommended Scope for Planning

1. Define one canonical, deterministic JavaScript verification command that
   runs unit tests, lint, and build; use it locally and in the existing CI
   workflow.
2. Change the existing workflow to run for the intended pull-request/push
   events, rather than creating a separate pipeline. Confirm the intended base
   branch and GitHub branch-protection policy before claiming it is required.
3. Document `npx supabase test db` as required for migration/RLS changes after
   `npx supabase start`; do not put it in generic CI without first proving
   Docker-based startup is deterministic in that environment.
4. Correct documentation so the supported commands and CI behavior match the
   repository. Update the Phase 3 cookbook with these commands and the
   conditional DB prerequisite.

## Risk-Response Corrections

The test plan's current claim that unit **and database** integration tests are
required "local + CI" after Phase 3 (`context/foundation/test-plan.md:88-92`)
is not supported by the current workflow or the archived DB-CI decision. The
plan should be corrected to distinguish automatic CI JavaScript checks from the
required local/database gate for migration and RLS changes, unless a later plan
phase proves and implements deterministic DB CI.

Branch-protection settings are not visible in repository files. Research cannot
prove that any workflow check is required for merge; planning must treat that as
an external configuration decision rather than an established fact.

## Architecture Insights

The project already follows a cost × signal split: pure business-state rules
are fastest in Vitest, while RLS, grants, migrations, and RPC effects need real
database integration. The quality floor should preserve that boundary. An e2e
or AI-based layer would duplicate deterministic coverage without exercising a
new necessary failure boundary.

## Historical Context

- `context/changes/testing-expense-settlement-state-protections/research.md`
  established the unit/pgTAP split for financial-state regressions.
- `context/changes/testing-family-authorization-migration-boundaries/research.md`
  established pgTAP as the cheapest credible signal for family isolation.
- `context/archive/2026-07-17-financial-rules-verification/plan.md` records
  the conditional decision for database CI.

## Open Questions

1. Which branch events should the existing CI workflow target, and which
   required-check settings are configured in GitHub?
2. Is a Docker-backed Supabase job acceptable in CI budget and execution time?
   If not, how should PR evidence record the required local database run?
