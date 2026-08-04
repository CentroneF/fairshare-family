# Risk-Based Regression Floor Implementation Plan

## Overview

Turn the existing financial-state and family-authorization test seams into a
reliable regression floor. Add one deterministic JavaScript verification
command, run it automatically for pull requests targeting `main`, retain the
current Astro setup, and document the separate local pgTAP requirement for
migration and RLS work.

## Current State Analysis

The repository has working Vitest and pgTAP suites but no canonical aggregate
verification command. `package.json` exposes separate test, lint, and build
scripts (`package.json:5-13`). The sole GitHub Actions workflow is
manual-dispatch only and executes Astro sync, lint, and build but not Vitest
(`.github/workflows/ci.yml:1-21`).

Database integration is deliberately different: it validates migrations, RLS,
grants, RPCs, and persisted effects through the local Supabase stack. It needs
Docker and `npx supabase start` (`README.md:77-109`), so it cannot be asserted
as a generic CI requirement without first proving an infrastructure setup.

## Desired End State

Every pull request to `main` automatically runs the same fast JavaScript gate
that contributors run locally: tests, lint, and build. Contributors can find
the required commands and know that migration/RLS work additionally needs a
locally started Supabase stack followed by `npx supabase test db`.

### Key Discoveries

- Existing financial semantic tests live in `src/lib/financial-rules.test.ts:33-100`;
  real authorization behavior is covered by
  `supabase/tests/family_authorization_boundaries.test.sql:1-113`.
- The current workflow has only `workflow_dispatch` and does not invoke tests
  (`.github/workflows/ci.yml:3-21`).
- The historic DB-CI decision prefers an explicit local command over a flaky
  job until deterministic startup without hosted secrets is proven
  (`context/archive/2026-07-17-financial-rules-verification/plan.md:193-200`).

## What We're NOT Doing

- Adding a Docker/Supabase database job to CI.
- Changing GitHub branch-protection or required-check settings.
- Adding browser, visual-snapshot, AI-native, coverage, mutation, or hook-based
  test gates.
- Changing the financial or authorization test implementations themselves.

## Implementation Approach

Use an npm script as the single source of truth for fast deterministic checks,
then have the existing workflow call it after its required Astro preparation.
Keep database verification out of that command because its required local stack
is materially different. Align contributor documentation and the test-plan
cookbook with this split so the actual workflow and stated policy agree.

## Critical Implementation Details

Keep `npx astro sync` as a distinct workflow step before the aggregate command:
the existing CI flow runs it before lint/build, while the local `verify` script
must remain runnable with normal project dependencies and avoid silently
starting external infrastructure. Do not claim a workflow check is merge
required; branch protection is external to this repository.

## Phase 1: Establish the Deterministic JavaScript Gate

### Overview

Create the canonical local command for the fast suite and prove it runs the
existing tests, static checks, and production build in the intended order.

### Changes Required

#### 1. Package verification scripts

**File**: `package.json`

**Intent**: Add `verify` as the documented aggregate command so local and CI
use the same test → lint → build contract.

**Contract**: `npm run verify` invokes the existing `test`, `lint`, and `build`
scripts sequentially and stops on the first failure; it does not start Supabase
or include `npx supabase test db`.

### Success Criteria

#### Automated Verification

- `npm run verify` exits successfully and executes Vitest, ESLint, and the
  Astro production build in that order.
- `npm test` remains a focused standalone command for developer feedback.

#### Manual Verification

- A contributor can identify `npm run verify` as the fast pre-PR JavaScript
  check without needing to reconstruct a command sequence.

---

## Phase 2: Enforce the Gate for Pull Requests

### Overview

Modify the existing GitHub Actions workflow so every pull request targeting
`main` runs the deterministic JavaScript gate, while preserving its setup and
secret handling.

### Changes Required

#### 1. Existing CI workflow

**File**: `.github/workflows/ci.yml`

**Intent**: Replace manual-only triggering with pull-request targeting `main`
and replace duplicated lint/build calls with the canonical command.

**Contract**: The workflow retains checkout, Node 22, npm caching, `npm ci`,
`npx astro sync`, and the existing Supabase environment variables for the build
path. It calls `npm run verify` once. It does not run on push and does not start
Supabase or execute pgTAP.

### Success Criteria

#### Automated Verification

- Workflow syntax remains valid and contains a `pull_request` trigger limited
  to `main`.
- The job retains dependency install and Astro sync, then invokes `npm run verify`.
- No CI step invokes `npx supabase start`, `supabase db reset`, or
  `npx supabase test db`.

#### Manual Verification

- Open a pull request to `main` and confirm the CI run starts and reports the
  aggregate verification check.

---

## Phase 3: Publish the Gate Contract and Cookbook

### Overview

Correct stale command/CI descriptions and record the final cost × signal split
in the test plan: automatic JavaScript checks on PRs, and explicit local pgTAP
verification for migration/RLS changes.

### Changes Required

#### 1. Contributor documentation

**Files**: `README.md`, `CLAUDE.md`

**Intent**: Make supported commands and CI behavior discoverable and truthful.

**Contract**: Both documents list `npm test` and `npm run verify`, state that CI
runs for pull requests to `main`, and explain that migration/RLS changes require
`npx supabase start` followed by `npx supabase test db`. Remove the obsolete
claims about every push/PR to `master` and the claim that no migrations exist.

#### 2. Test rollout cookbook and quality-gate policy

**File**: `context/foundation/test-plan.md`

**Intent**: Replace the Phase 3 TBD cookbook entry and correct the unsupported
claim that database integration is automatically required in CI.

**Contract**: §5 distinguishes automatic PR CI for Vitest/lint/build from the
required local database gate for migration/RLS work; §6.3 gives the exact fast
and database command paths plus prerequisites. Preserve the risk map, its
evidence-only source rule, and all completed rollout history.

### Success Criteria

#### Automated Verification

- Documentation commands match `package.json` and `.github/workflows/ci.yml`.
- `git diff --check` passes.
- `npm run verify` passes after documentation/configuration changes.

#### Manual Verification

- Read the README and test-plan cookbook as a new contributor and identify:
  the PR gate, the fast local command, and the conditional database command.
- Confirm the final documentation makes no claim that DB integration is a
  generic CI check or that GitHub branch protection is configured.

## Testing Strategy

### Configuration and Documentation Checks

- Validate the aggregate script by running it, not by mocking npm lifecycle
  behavior.
- Inspect workflow trigger and command changes as text; GitHub branch-protection
  behavior is deliberately outside the repository test surface.
- Retain real pgTAP execution for migration/RLS changes because route mocks and
  unit tests cannot validate RLS/grant behavior.

### Manual Testing Steps

1. Run `npm run verify` from a clean dependency install.
2. Start the local Supabase stack and run `npx supabase test db` when validating
   a migration/RLS change; do not use `supabase db reset`.
3. Open a pull request targeting `main` and confirm the CI workflow executes
   the aggregate gate.

## Migration Notes

No database migration or data backfill is part of this change. The plan only
clarifies how existing migrations and RLS tests must be verified.

## References

- Research: `context/changes/testing-risk-based-regression-floor/research.md`
- Test rollout: `context/foundation/test-plan.md`
- Existing workflow: `.github/workflows/ci.yml:1-21`
- Historical DB-CI constraint:
  `context/archive/2026-07-17-financial-rules-verification/plan.md:193-200`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Establish the Deterministic JavaScript Gate

#### Automated

- [x] 1.1 Add the canonical `npm run verify` test → lint → build script — 99621c3
- [x] 1.2 Run the aggregate command and preserve standalone Vitest execution — 99621c3

#### Manual

- [x] 1.3 Confirm the command is discoverable as the fast local pre-PR gate — 99621c3

### Phase 2: Enforce the Gate for Pull Requests

#### Automated

- [x] 2.1 Configure the existing workflow for pull requests targeting `main` — 74b7a91
- [x] 2.2 Retain setup/env handling and replace duplicated checks with `npm run verify` — 74b7a91
- [x] 2.3 Validate workflow syntax and confirm pgTAP remains outside CI — 74b7a91

#### Manual

- [x] 2.4 Confirm a pull request to `main` starts and reports the aggregate CI gate

### Phase 3: Publish the Gate Contract and Cookbook

#### Automated

- [ ] 3.1 Update README and CLAUDE command, CI, migration, and database-test guidance
- [ ] 3.2 Update test-plan §5 and §6.3 with the automatic-versus-local gate split
- [ ] 3.3 Run `git diff --check` and `npm run verify`

#### Manual

- [ ] 3.4 Confirm a new contributor can identify the PR, fast-local, and conditional-database paths
