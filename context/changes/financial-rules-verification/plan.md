# Financial Rules Verification Implementation Plan

## Overview

Build the financial trust boundary for FairShare Family: a minimal family-access schema, fixed-decimal PLN expense persistence, and server-side rules that calculate balances and settlement eligibility exactly. This is intentionally a foundation change with automated verification, not a user-facing finance feature.

## Current State Analysis

Astro authentication is already connected to Supabase, and middleware records the authenticated user for protected dashboard requests. The project has no application migrations, no domain tables, no financial calculation module, and no automated test script. The Supabase CLI is installed, migrations and seed execution are enabled, and the local database is configured for PostgreSQL 17.

## Desired End State

After this change, local `supabase db reset` creates the foundation schema and `supabase test db` proves database constraints and RLS policy behaviour. A server-only domain module can calculate the exact approved total, pending total, each parent’s net position, rounded settlement amount, and whether a past month is eligible for joint settlement. Later onboarding and expense/report UI slices can consume these contracts without inventing a parallel data model.

### Key Discoveries:

- `src/lib/supabase.ts:5` already creates the request-scoped server client that future server routes use; it must remain the non-service-role default.
- `src/middleware.ts:4` protects only `/dashboard`; no family or financial route/API exists yet.
- `supabase/config.toml:50` enables migrations and `supabase/config.toml:57` runs `seed.sql` on reset, but `supabase/migrations/` and `supabase/tests/` do not yet exist.
- `package.json:4` exposes lint and build scripts only; no unit-test command is available.
- `context/foundation/prd.md` requires exact amounts, fixed 50/50 splits, final half-up whole-unit rounding, and family-only data access.

## What We're NOT Doing

- Building onboarding, join-code issuance, or child-management UI; S-01 owns those flows.
- Building expense, approval, balance, history, or settlement UI/API routes; S-02 through S-05 own their user journeys.
- Supporting currencies other than PLN, custom split ratios, recurring expenses, comments, notifications, or money transfers.
- Adding an expense revision-event log, cached aggregates, or a production database push.

## Implementation Approach

Create a single additive foundation migration with a deliberately small relational model: families, active parent memberships, children, expenses, and one family/month settlement record. The database owns durable facts, structural constraints, and row visibility; server-only TypeScript owns exact calculation and transition validation. Do not store derived monthly totals: query approved and pending expense records and derive report values when requested.

Use `numeric(12,2)` for PLN amounts and Decimal.js rather than JavaScript `number` for all calculation paths. Keep direct table mutation unavailable to ordinary authenticated clients; later server operations use the request-scoped user client and narrowly scoped database routines/policies, never a broadly exposed service-role client. Add Vitest for pure rules and pgTAP tests for migration, constraint, and RLS behaviour.

## Critical Implementation Details

The first migration is shared infrastructure, not an S-01 implementation. It may create minimal family and membership records needed for referential integrity and authorization, but it must not encode join-code UX or introduce a second membership model. Settle-state mutations must remain unavailable until the later joint-settlement slice; this change only provides the state contract and eligibility evaluation.

## Phase 1: Database Foundation and Access Boundary

### Overview

Define the minimal durable model on which onboarding and financial slices can safely build, and enforce family isolation and immutable financial invariants at the database boundary.

### Changes Required:

#### 1. Financial foundation migration

**File**: `supabase/migrations/<timestamp>_financial_rules_foundation.sql`

**Intent**: Add the initial family-access and financial persistence schema so every expense belongs to exactly one family, a known payer, and an auditable approval state.

**Contract**: Create `families`, `family_members`, `children`, `expenses`, and `monthly_settlements` tables. Use UUID primary keys and `auth.users(id)` references where appropriate. Limit each account to one family and each family to at most two active `parent` members. `expenses` must carry `family_id`, nullable `child_id`, `payer_id`, non-empty description, `expense_date`, `amount_pln numeric(12,2)`, `status` (`pending`, `approved`, or `declined`), and current-state reviewer/decision timestamp metadata. Require positive amounts and valid reviewer metadata: only resolved states have reviewer and timestamp, and a reviewer cannot be the payer. `monthly_settlements` must key by family/month and retain two distinct parent confirmations plus final settlement timestamp/state, without implementing a settlement action.

#### 2. Row-level security and database authorization helpers

**File**: `supabase/migrations/<timestamp>_financial_rules_foundation.sql`

**Intent**: Ensure authenticated parents can see only their own family while direct client writes cannot bypass later server-side validation.

**Contract**: Enable and force RLS on every new table. Add reusable SQL predicates/functions that identify the authenticated user’s active membership. Permit family-scoped `SELECT` only to active members. Do not grant ordinary authenticated roles direct `INSERT`, `UPDATE`, or `DELETE` policies on expenses or monthly settlements; establish narrowly scoped, authenticated, guarded routines only where an initial family/membership record must be created for the later onboarding flow. All routines must check `auth.uid()` and active membership rather than trusting caller-supplied IDs.

#### 3. Local schema reset fixture

**File**: `supabase/seed.sql`

**Intent**: Keep `supabase db reset` deterministic without seeding production-like users or financial records.

**Contract**: Retain a comment-only or empty-safe seed contract, documenting that pgTAP creates its own isolated auth identities and fixtures. It must not weaken RLS or install test-only production objects.

### Success Criteria:

#### Automated Verification:

- `npx supabase db reset` applies the migration and seed with no schema errors.
- Database checks reject non-positive amounts, a third active parent, cross-family foreign-key combinations, self-review, and incomplete resolved-state metadata.
- The schema exposes no direct authenticated expense or settlement mutation policy.

#### Manual Verification:

- In local Supabase Studio, inspect that every foundation table has RLS enabled and that a family has no more than two active parent memberships.
- Review the migration SQL with the human before it is applied to any hosted project.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Exact Financial Domain Rules

### Overview

Create a server-only, framework-independent financial rules module that derives report values exactly from expense records and family membership facts.

### Changes Required:

#### 1. Money and reporting domain module

**File**: `src/lib/financial-rules.ts`

**Intent**: Centralize the rules that later expense, report, and settlement routes will call so calculations cannot drift between UI surfaces.

**Contract**: Add typed domain inputs/outputs and pure functions that accept decimal strings or Decimal instances, never binary floats. Validate PLN amounts as positive with no more than two decimal places. Derive `totalAmount`, `approvedAmount`, `toReviewAmount`, parent contribution totals, and a directed net balance from the selected month’s expenses. Only `approved` expenses affect the split; `pending` contributes to `toReviewAmount`; `declined` remains excluded from all report totals. Round only the absolute final settlement amount to a whole PLN with Decimal.js `ROUND_HALF_UP`; a zero net must return a no-settlement result.

#### 2. Approval and settlement eligibility rules

**File**: `src/lib/financial-rules.ts`

**Intent**: Make review and settlement preconditions explicit before routes or database procedures perform a mutation.

**Contract**: Export predicates that require two active, distinct parents for shared approval, reject the payer as reviewer, and allow a month to become settlement-eligible only when it is in the past and every expense is approved. Pending or declined expenses make the month ineligible; zero balance is eligible to be displayed as balanced but must not yield a payment or settlement action.

#### 3. Test tooling configuration

**Files**: `package.json`, `package-lock.json`, `vitest.config.ts` (if required by the selected test layout)

**Intent**: Add a reproducible unit-test command without changing the production runtime.

**Contract**: Add `vitest` and `decimal.js` as project dependencies in the appropriate dependency sections and expose `npm test` for a single non-watch unit-test run. Keep test discovery limited to the new `src/lib/**/*.test.ts` files and compatible with the existing TypeScript/ESM setup.

### Success Criteria:

#### Automated Verification:

- `npm test` passes cases for `0.01`, values ending in `.50`, uneven parent totals, no approved expenses, and a final zero balance.
- Unit tests prove that a third decimal place and non-positive amounts are rejected before persistence.
- Unit tests prove declined expenses remain visible-domain records but do not affect approved totals, balance, or settlement eligibility.

#### Manual Verification:

- Review representative report outputs (one parent paid all, both paid equally, and a pending-only month) with the human and confirm the wording/direction matches the product’s “owes/is owed” language.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Server Integration Contract

### Overview

Connect the domain rules to a server-only data boundary that future Astro endpoints can reuse without allowing browser code to invent authorization or arithmetic.

### Changes Required:

#### 1. Financial repository/service module

**File**: `src/lib/financial-service.ts`

**Intent**: Define the only application-level entry points for loading family-scoped financial inputs and validating future expense/review/settlement commands.

**Contract**: Accept a request-scoped Supabase client and authenticated user ID, load only records visible to that user, map database numeric fields to Decimal-safe domain inputs, and return typed rule outputs. Provide command-validation functions for create, review, and settlement requests that invoke the domain predicates before any future database routine is called. Do not add browser exports, a service-role client, or public HTTP routes in this change.

#### 2. Server-boundary documentation in existing Supabase helper

**File**: `src/lib/supabase.ts`

**Intent**: Make the required request-scoped, user-token path obvious to later implementers using the financial service.

**Contract**: Preserve `createClient`’s existing SSR cookie behaviour and document/type the null-client failure path as the boundary consumed by the financial service. No secret, service-role key, or browser-accessible administrative client may be introduced.

### Success Criteria:

#### Automated Verification:

- Type-aware unit tests cover conversion of database numeric strings without `number` coercion.
- The application has no new client-side import of `financial-service.ts` and no service-role environment variable.
- `npm run lint` passes for the new server/domain modules.

#### Manual Verification:

- Review the module’s public exports and confirm they are sufficient for S-02/S-05 without prematurely adding endpoints or UI.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Database Verification and Planning Handoff

### Overview

Prove the database authorization contract under realistic authenticated roles, then record the resolved product decisions and corrected slice dependency in foundation documents.

### Changes Required:

#### 1. pgTAP integration suite

**File**: `supabase/tests/financial_rules_foundation.test.sql`

**Intent**: Test the migration’s real PostgreSQL constraints and RLS policies rather than trusting application-level unit tests alone.

**Contract**: Create isolated auth users, two families, memberships, children, expenses, and settlement fixtures. Use role/JWT claim setup supported by the Supabase test harness to prove: an active parent can read only their own family; non-members cannot read family data; direct expense/settlement mutations are denied; self-review and cross-family references fail; and the two-parent cap holds. Keep fixtures local and transactional.

#### 2. Project command and CI documentation

**Files**: `package.json`, `AGENTS.md`, `.github/workflows/ci.yml`

**Intent**: Make the newly introduced verification discoverable and ready for a future CI environment that can provide a Supabase local stack.

**Contract**: Document `npm test` and `npx supabase test db` in the repository guide. Keep the existing cloud CI build path working; add database-test CI only if the workflow can start the local Supabase stack deterministically without hosted secrets. Otherwise leave an explicit documented local command rather than adding a flaky job.

#### 3. Foundation decision and dependency updates

**Files**: `context/foundation/prd.md`, `context/foundation/roadmap.md`

**Intent**: Record that PLN is resolved and that the financial foundation supplies the shared schema before onboarding implements its user flows.

**Contract**: Replace the currency open question with the PLN-only decision. Mark F-01 as planned, remove its currency blocker, make S-01 depend on F-01 rather than run in parallel, and update its readiness/status plus the roadmap graph/stream/backlog wording consistently. Do not modify any archived context.

### Success Criteria:

#### Automated Verification:

- `npx supabase test db` passes the pgTAP foundation suite against a freshly reset local database.
- `npm test`, `npm run lint`, and `npm run build` all pass.
- `git diff --check` passes with only this change’s intended source, test, configuration, and planning/documentation files.

#### Manual Verification:

- Run the final command sequence from a clean local checkout and confirm the plan’s documented order is sufficient for a new contributor.
- Review the PRD and roadmap wording to confirm PLN and the F-01 → S-01 dependency match the approved decision.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- Validate decimal input parsing: positive values with zero, one, or two decimals are allowed; negative, zero, non-numeric, and three-plus-decimal inputs are rejected.
- Verify fixed 50/50 contribution and directed balance calculations with exact decimal strings.
- Verify final-only whole-PLN half-up rounding, including `.49`, `.50`, and `.51` boundary cases.
- Verify pending/declined handling, reviewer ownership, two-parent approval availability, past-month restriction, and zero-balance no-action result.

### Integration Tests:

- Apply the migration from an empty local database.
- Exercise constraints for amounts, family membership uniqueness/cap, reviewer metadata, family/child/payer relationships, and unique family/month settlement records.
- Set authenticated identities to verify RLS reads and denied direct writes across two families.

### Manual Testing Steps:

1. Reset the local database, inspect the schema/RLS flags in Studio, and verify no production-like fixture data was seeded.
2. Review example rule outputs for uneven, equal, and pending-only months.
3. Re-run the documented test, lint, and build commands from a clean working tree before opening the implementation PR.

## Performance Considerations

Monthly totals are deliberately derived on demand for the MVP. Add indexes supporting the intended reads: active membership by user/family, expenses by family and expense date/status, and settlements by family/month. Do not cache aggregates or introduce reconciliation machinery until real data volume justifies it.

## Migration Notes

This is the first application schema migration, so no existing application data needs transformation. It must be additive and safe to apply once to a hosted project after local verification; never use `supabase db reset` against the hosted project. Rollback is a reviewed forward migration because removing financial tables could destroy user records once deployed.

## References

- Product contract: `context/foundation/prd.md`
- Roadmap source: `context/foundation/roadmap.md`
- Existing SSR Supabase client: `src/lib/supabase.ts:1`
- Existing authentication middleware: `src/middleware.ts:1`
- Local Supabase configuration: `supabase/config.toml:50`
- Supabase database testing documentation: <https://supabase.com/docs/guides/local-development/cli/testing>

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Database Foundation and Access Boundary

#### Automated

- [x] 1.1 Apply the financial foundation migration with a clean local reset — 83630b8
- [x] 1.2 Verify schema constraints reject invalid family, expense, and review states — 83630b8
- [x] 1.3 Verify direct authenticated expense and settlement mutations are unavailable — 83630b8

#### Manual

- [x] 1.4 Inspect RLS enablement and two-parent membership behaviour in local Studio — 83630b8
- [x] 1.5 Review migration SQL before hosted application — 83630b8

### Phase 2: Exact Financial Domain Rules

#### Automated

- [x] 2.1 Run exact-money and final half-up rounding unit cases — 8155b0a
- [x] 2.2 Verify invalid decimal input and declined-expense exclusion cases — 8155b0a

#### Manual

- [x] 2.3 Review directed balance outputs for representative monthly scenarios — 8155b0a

### Phase 3: Server Integration Contract

#### Automated

- [x] 3.1 Verify Decimal-safe database mapping and server-only module boundary — 85543c5
- [x] 3.2 Run lint for the new financial service and domain modules — 85543c5

#### Manual

- [x] 3.3 Review public service exports against S-02 and S-05 needs — 85543c5

### Phase 4: Database Verification and Planning Handoff

#### Automated

- [x] 4.1 Run pgTAP RLS and constraint integration tests against a fresh local database — d07757f
- [x] 4.2 Run unit tests, lint, build, and whitespace validation — d07757f

#### Manual

- [x] 4.3 Confirm the documented verification sequence from a clean checkout — d07757f
- [x] 4.4 Confirm PRD and roadmap record PLN and F-01 to S-01 sequencing — d07757f
