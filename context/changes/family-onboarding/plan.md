# Family Onboarding Implementation Plan

## Overview

Deliver the first shared-family workflow: an authenticated parent names and creates one family, adds children, shares a short join code, and a second parent explicitly confirms joining it. The implementation extends the existing financial foundation without relaxing its RLS or direct-write protections.

## Current State Analysis

Email/password authentication and a protected `/dashboard` already exist, but the dashboard is a placeholder. The financial-rules foundation has already created the family, membership, and children tables; its RLS model permits reads only and reserves mutations for authenticated, security-definer RPCs.

## Desired End State

After sign-in, `/dashboard` presents exactly one state for the authenticated user: create a named family, enter a code and confirm joining its named family, wait for the second parent while managing children and sharing/regenerating the code, or view the shared two-parent family summary. A family has at most two parents, an account belongs to at most one family, and only active members can read family data.

### Key Discoveries:

- `family_members.user_id` is unique and the parent-cap trigger locks the family before counting active parents, preserving the one-family and two-parent invariants. `supabase/migrations/20260717160000_financial_rules_foundation.sql:11`
- `create_family()` is the existing authenticated mutation boundary; all domain tables have forced RLS and no mutation policies. `supabase/migrations/20260717160000_financial_rules_foundation.sql:217`
- The request-scoped Supabase client carries the user session and explicitly forbids a service-role client. `src/lib/supabase.ts:5`
- Auth form components already use controlled React validation and standard HTML POST routes; dashboard content is currently static. `src/components/auth/SignUpForm.tsx:14`, `src/pages/dashboard.astro:7`
- pgTAP is established for migration-level authorization checks. `supabase/tests/financial_rules_foundation.test.sql:1`

## What We're NOT Doing

- Email-delivered invitations, invitation expiry, or a join link.
- Families with more than two parents or accounts belonging to multiple families.
- Editing or deleting persisted children; this slice only adds children and removes unsaved entries before submission.
- Expense entry, review, balance, settlement, notifications, comments, or a browser E2E framework.
- A service-role client, direct client writes, or mutation RLS policies.

## Implementation Approach

Add a forward-only Supabase migration that stores a required family name and an opaque random code on each family and exposes narrow authenticated RPCs. The database RPCs generate the code, so randomness remains enforced even when an authenticated caller invokes an RPC directly. Build Astro API routes around the existing request-scoped Supabase client, then use a server-rendered dashboard to select the onboarding state and small React forms for validation and interaction. A code-preview request reveals the family name only after a valid code is supplied; a separate confirmation request performs the membership creation. Keep all authoritative validation in the database RPCs and make UI errors safe, clear, and non-disclosing.

## Critical Implementation Details

The code-preview operation never creates membership. The confirmation operation must resolve the case-preserved code again, reject an account that already has a membership, and insert the membership in the same database operation. The existing parent-limit trigger is the concurrency backstop, so neither the preview nor the confirmation dialog is treated as authorization.

## Phase 1: Secure Family-Onboarding Database Contract

### Overview

Create the migration and database verification suite for family creation, child creation, join-code sharing, code regeneration, and second-parent joining.

### Changes Required:

#### 1. Family onboarding migration

**File**: `supabase/migrations/20260720120000_family_onboarding.sql`

**Intent**: Extend the existing family schema with an active join code and create the only permitted mutation interfaces for the onboarding flow, without changing the financial foundation migration.

**Contract**: Add a required, trimmed, nonblank `name` field and a unique case-sensitive join-code field to `public.families`; family names are not globally unique. Codes are opaque eight-character alphanumeric strings generated with cryptographically secure randomness inside the create/regenerate database RPCs. Define and grant authenticated execution on RPCs to create a named family and return its generated code, preview a family name from a valid code without mutation, confirm joining a family by code, regenerate a code only for the creator while exactly one active parent exists, and add a nonblank child for an active family member. Revoke public execution on every onboarding RPC. The preview and confirmation RPCs must reject anonymous callers, invalid or inactive codes, existing memberships, and full families with domain-safe errors; confirmation revalidates every condition after preview.

#### 2. Onboarding database authorization tests

**File**: `supabase/tests/family_onboarding.test.sql`

**Intent**: Prove the onboarding contract works through RPCs while direct base-table mutation remains unavailable.

**Contract**: Follow the existing pgTAP transaction, JWT-claim, and `authenticated` role setup. Cover required family-name validation and visibility, creation and creator membership, eight-character case-sensitive database-generated codes, preview returning a name without creating membership, child validation and family isolation, confirmation creating the valid second-parent membership, invalid and regenerated-code rejection at preview and confirmation, prevention of a second family/membership, third-parent rejection, code hiding/availability through normal RLS reads, and denied direct insert/update/delete operations.

### Success Criteria:

#### Automated Verification:

- The new migration applies to a clean local Supabase database.
- `zsh -lic 'nvm use default >/dev/null && npx supabase test db'` passes, including the onboarding pgTAP suite.
- The test suite proves no direct mutation policy was added to onboarding tables.

**Implementation Note**: No phase-specific manual step applies. The Phase 3 end-to-end flow verifies the created family’s name, creator membership, and code visibility before this change is considered complete.

---

## Phase 2: Server-Owned Onboarding Flow

### Overview

Make the authenticated server the sole application caller of the onboarding RPCs and derive the dashboard state from the current user’s membership.

### Changes Required:

#### 1. Family onboarding server module

**File**: `src/lib/family-onboarding.ts`

**Intent**: Centralize request-scoped reads and RPC calls so dashboard rendering and API routes share typed state mapping and safe error translation.

**Contract**: Accept the existing request-scoped Supabase client and expose operations for resolving the authenticated user’s onboarding state, creating a named family, adding a child, previewing a family name by code, confirming a join by code, and regenerating the code. Preserve the entered code case exactly; the database RPC owns generation and collision handling. Return a discriminated dashboard state for `no-family`, `creator-awaiting-parent`, and `two-parent-family`; validate input before RPC invocation and map known database failures to safe user-facing messages.

#### 2. Onboarding API routes

**Files**: `src/pages/api/family/create.ts`, `src/pages/api/family/join/preview.ts`, `src/pages/api/family/join/confirm.ts`, `src/pages/api/family/children.ts`, `src/pages/api/family/regenerate-code.ts`

**Intent**: Add POST endpoints that use the signed-in request session and invoke the server module, including a non-mutating join preview and a separately confirmed join.

**Contract**: Each route rejects missing/unauthenticated Supabase configuration consistently with existing auth routes, accepts only its scoped form payload, and never trusts a client-provided family or user ID. Create, child, regenerate, and confirmed-join routes redirect to `/dashboard` on success or `/dashboard?error=...` on failure. The preview route returns only the valid family name needed for the confirmation dialog and performs no mutation; confirm receives the code again and revalidates it server-side. All code generation, membership checks, and family authorization remain in the database RPCs.

#### 3. Dashboard state loading and navigation consistency

**Files**: `src/pages/dashboard.astro`, `src/pages/api/auth/signin.ts`, `src/pages/api/auth/signup.ts`

**Intent**: Replace the placeholder dashboard with server-derived onboarding data and make successful authentication enter the single dashboard flow.

**Contract**: The dashboard loads its state through the request-scoped client, remains protected by existing middleware, and passes only the current state/data needed by UI components. Successful sign-in and any immediately authenticated sign-up redirect to `/dashboard`; email-confirmation behavior remains unchanged when no session is established.

### Success Criteria:

#### Automated Verification:

- Focused Vitest tests cover state mapping, case-sensitive code handling, non-mutating join preview, and safe database-error mapping in `src/lib/family-onboarding.test.ts`.
- `zsh -lic 'nvm use default >/dev/null && npm test'` passes.
- `zsh -lic 'nvm use default >/dev/null && npm run lint'` passes.

**Implementation Note**: The Phase 3 interactive dashboard exercises the server routes end to end, including their valid and invalid request behavior.

---

## Phase 3: State-Driven Onboarding Dashboard

### Overview

Provide responsive, accessible UI for every approved onboarding state using the project’s existing Tailwind and React-form conventions.

### Changes Required:

#### 1. Dashboard onboarding components

**Files**: `src/components/family/CreateFamilyForm.tsx`, `src/components/family/JoinFamilyForm.tsx`, `src/components/family/FamilySetupPanel.tsx`, `src/components/family/FamilySummaryPanel.astro`

**Intent**: Let a user name and create a family or preview and confirm joining one, let the creator manage initial child names and share/regenerate the code, and let both parents see the shared family summary after joining.

**Contract**: The create form requires a trimmed, nonblank family name. Join input preserves the case entered and submits to the preview endpoint; only a successful preview opens an accessible confirmation dialog that says `Do you want to join the {name} family?`. Cancel closes the dialog without mutation; confirm submits the original code to the confirm endpoint. Child names are trimmed and nonblank; the setup panel permits adding/removing unsaved rows before saving. The active code is visible only in the creator-awaiting-parent state; it disappears after the second parent joins. Components use labelled controls, inline error text, focus management for the dialog, and responsive layouts matching existing auth forms.

#### 2. Dashboard composition and feedback

**File**: `src/pages/dashboard.astro`

**Intent**: Select exactly one approved user state and display API feedback without revealing protected family information.

**Contract**: `no-family` shows create and join choices, `creator-awaiting-parent` shows the family name, child setup, and code controls, and `two-parent-family` shows the common family name/children summary plus sign-out. Query-string success/error feedback is displayed accessibly and does not expose raw database errors.

#### 3. UI-focused test coverage

**Files**: `src/lib/family-onboarding.test.ts`

**Intent**: Keep automated coverage limited to pure onboarding-state and input-handling behavior; verify the interactive confirmation dialog through the manual test flow rather than introducing a DOM test environment.

**Contract**: Extend the focused library tests only where behavior remains pure: blank family-name and malformed-code validation, case-sensitive code preservation, safe error mapping, and dashboard-state selection. Verify confirmation-dialog copy, cancellation, unsaved-child removal, and code visibility through the Phase 3 manual scenarios.

### Success Criteria:

#### Automated Verification:

- Focused library tests pass with `zsh -lic 'nvm use default >/dev/null && npm test'`.
- Database tests pass with `zsh -lic 'nvm use default >/dev/null && npx supabase test db'`.
- `zsh -lic 'nvm use default >/dev/null && npm run lint'` and `zsh -lic 'nvm use default >/dev/null && npm run build'` pass.

#### Manual Verification:

- In Supabase Studio, inspect a family created through the UI and confirm its required name, sole initial creator membership, and generated code use the agreed format.
- Sign in as an account without a family and confirm the dashboard presents create-or-join actions.
- On desktop and a narrow Android-sized viewport, create a named family, add children, copy/share its code, regenerate it, and verify the previous code fails.
- Sign in as a second account, preview the current code, cancel once, then confirm the dialog reading `Do you want to join the {name} family?`; verify both accounts see the same family name and children while neither sees the code afterward.
- Attempt a repeat join, an invalid code, and a third account join; confirm safe explanatory errors and no cross-family data exposure.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before considering the change complete.

---

## Testing Strategy

### Unit Tests:

- Dashboard state mapping from family-membership data.
- Family-name validation and case-sensitive local form handling.
- Safe mapping of known RPC failures to UI feedback.
- Dashboard-state selection and safe server-error mapping; interactive dialog behavior is covered by manual verification.

### Integration Tests:

- pgTAP authenticated-RPC tests for creating named families, previewing, confirming joins, regenerating, and adding children.
- RLS isolation and continued denial of direct table mutation.
- Sequential and concurrent-safe enforcement of one membership per account and two active parents per family.

### Manual Testing Steps:

1. Create and sign in as the first parent, then create a named family without adding a child.
2. Add multiple children, remove an unsaved child, regenerate the code, and confirm the old code fails.
3. Sign in as a second account, enter the current code, and cancel the resulting family-name confirmation dialog once.
4. Re-enter the code, confirm `Do you want to join the {name} family?`, and verify both parents see the same family name and children; confirm the code no longer appears.
5. Try joining from a third account and accessing another family; confirm both are denied safely.

## Performance Considerations

The dashboard reads a single family, up to two members, and a small child list. No pagination, caching, or asynchronous workflow is needed for this MVP slice; unique constraints and the existing parent-cap locking protect correctness under concurrent join attempts.

## Migration Notes

Add a new forward-only migration; do not edit the already-applied financial foundation migration. There is no existing production family data before this slice. Rollback is additive at the application level: disable the new routes/UI if necessary while keeping the migration and data intact.

## References

- Product requirements: `context/foundation/prd.md`
- Roadmap slice: `context/foundation/roadmap.md`
- Existing family and RLS foundation: `supabase/migrations/20260717160000_financial_rules_foundation.sql:4`
- Auth/session pattern: `src/lib/supabase.ts:5`
- Current dashboard: `src/pages/dashboard.astro:7`
- Existing database authorization tests: `supabase/tests/financial_rules_foundation.test.sql:1`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Secure Family-Onboarding Database Contract

#### Automated

- [x] 1.1 New onboarding migration applies to a clean local Supabase database. — 557808e
- [x] 1.2 `npx supabase test db` passes, including onboarding pgTAP coverage. — 557808e
- [x] 1.3 Tests prove direct mutation policies remain absent. — 557808e

### Phase 2: Server-Owned Onboarding Flow

#### Automated

- [x] 2.1 Focused family-onboarding Vitest tests pass.
- [x] 2.2 `npm test` passes.
- [x] 2.3 `npm run lint` passes.

### Phase 3: State-Driven Onboarding Dashboard

#### Automated

- [ ] 3.1 Focused library tests pass with `npm test`.
- [ ] 3.2 Database tests pass with `npx supabase test db`.
- [ ] 3.3 `npm run lint` and `npm run build` pass.

#### Manual

- [ ] 3.4 Inspect the UI-created family name, initial member, and code format in Supabase Studio.
- [ ] 3.5 An account without a family reaches the create-or-join dashboard state.
- [ ] 3.6 Named-family onboarding, children, code regeneration, and invalid old-code behavior work on desktop and a narrow viewport.
- [ ] 3.7 A second account previews, cancels, then confirms joining the named family; both parents see the shared family without the join code.
- [ ] 3.8 Repeat, invalid, and third-account joins fail safely without data exposure.
