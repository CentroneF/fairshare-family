# UX Changes Implementation Plan

## Overview

Improve the expense and dashboard experience by adding family-scoped display
names, making expense feedback readable on small screens, and removing actions
that cannot succeed for the current month.

## Current State Analysis

Expense records identify their creator through `payer_id`, a reference to a
`family_members` row. That row has no name today, so the interface can only
identify the signed-in user by email and cannot safely label another parent's
expenses. The dashboard renders a disabled settlement button for every
unavailable state, including the current month, and the expense-card action row
uses flex stretching that enlarges Decline when an approval error is appended.

## Desired End State

Every parent has a required, fixed 5–15-character display name. The menu
shows it below the email, and active and declined expense cards show the
creator's current display name. Existing accounts are prompted for a name
before they can use the expense workspace. On the dashboard, the current month
explains why settlement is unavailable without rendering a Confirm settlement
button; other unavailable reasons retain their existing CTA and explanation.

### Key Discoveries

- `expenses.payer_id` already references a family-scoped membership in
  `supabase/migrations/20260717160000_financial_rules_foundation.sql`.
- Expense loading and display mapping are centralized in
  `src/lib/expense-balance.ts`; `ExpenseList.astro` renders both active and
  declined cards.
- The supplied screenshot matches the approval error appended inside a flex
  child in `src/components/expenses/ExpenseList.astro`, stretching its sibling
  Decline button.
- `getSettlementUnavailableReason()` already distinguishes `current-month` in
  `src/lib/expense-balance.ts`; only the dashboard presentation needs to hide
  the CTA.

## What We're NOT Doing

- Creating a global public profile table, exposing auth-user data, or showing
  parent email addresses on expense cards.
- Changing settlement eligibility rules or hiding the settlement CTA for
  historical report views.
- Changing decline-reason validation, approval authorization, or expense
  financial calculations.

## Implementation Approach

Add `display_name` to the existing `family_members` identity boundary and use
security-definer RPCs for creation and updates, preserving the project rule
that authenticated users do not directly mutate family data. Extend the
workspace query with the payer membership name, use a gated profile-completion
surface for existing members, and apply the remaining focused UI changes in
separate, front-end-verifiable phases.

## Critical Implementation Details

Existing memberships cannot be backfilled with names from Supabase Auth through
the browser client. Keep the column nullable for the forward migration, require
a valid name in new family/join flows, and gate members with a null name behind
the completion form until they save one. Query the payer through the existing
family-member relationship so RLS continues to limit names to active
co-parents.

## Phase 1: Establish parent display names

### Overview

Deliver required parent names and show the current name consistently
in the menu and on every expense card.

### Changes Required

#### 1. Family-member display-name migration and database tests

**Files**: `supabase/migrations/<timestamp>_family_member_display_names.sql`,
`supabase/tests/family_member_display_names.test.sql`

**Intent**: Add a family-scoped display name without weakening the existing RLS
or direct-write protections. Existing unnamed members can complete a name once;
set names are immutable.

**Contract**: `family_members.display_name` accepts trimmed values from 5 to 15
characters and remains nullable only for pre-existing accounts. Family creation
and family-join RPCs accept and persist a validated name; an authenticated,
active parent with no saved name can complete it through a dedicated RPC. Revoke
default public execution and grant the new RPC only to `authenticated`.

#### 2. Name validation and profile-completion client contract

**Files**: `src/lib/family-onboarding.ts`,
`src/lib/family-onboarding.test.ts`, `src/pages/api/family/profile.ts`

**Intent**: Keep the 5–15-character normalization and safe error mapping in the
existing onboarding boundary, and expose one authenticated update route.

**Contract**: Provide a shared display-name normalizer and client operation for
the update RPC. The API route accepts a form value, returns JSON for background
submission, and never performs a full-page form post.

#### 3. Signup, onboarding gate, and navigation profile controls

**Files**: `src/components/auth/SignUpForm.tsx`,
`src/pages/api/auth/signup.ts`, `src/lib/family-onboarding.ts`,
`src/pages/dashboard.astro`, `src/components/DashboardNavigation.astro`,
`src/components/family/ParentProfileForm.tsx`

**Intent**: Collect a name from new users, prevent unnamed existing users from
entering the expense workspace.

**Contract**: Sign-up supplies the display name to the account metadata needed
by later family creation/join actions. Onboarding state exposes the current
member name (or its absence). An unnamed authenticated member sees only the
profile-completion form until successful background save; named members see the
name beneath their email in desktop and mobile navigation.

#### 4. Creator names in workspace data and expense cards

**Files**: `src/lib/expense-balance.ts`, `src/lib/expense-balance.test.ts`,
`src/components/expenses/ExpenseList.astro`

**Intent**: Show the current creator name for active and declined expenses
without affecting payer-based permissions or balance calculations.

**Contract**: Extend the expense query, parser, and `ExpenseDisplay` with the
payer membership display name. Render that name in both card variants; retain
`payerId` for permission checks and financial logic.

### Success Criteria

#### Automated Verification

- `npx supabase test db` passes, including display-name validation,
  self-update authorization, and existing RLS boundaries.
- `npm test` passes with name normalization, onboarding-state, and
  expense-row-mapping coverage.
- `npm run lint` passes.

#### Manual Verification

- A new user supplies a 5–15-character name, creates or joins a family, and
  sees it below their email in both navigation layouts.
- An existing unnamed member is prompted to save a name before using expenses;
  after saving, both parents see the current creator name on active and
  declined expense cards.
- Once saved, a display name remains fixed while the menu and historic card labels
  retain it after refresh.

**Implementation Note**: Pause after automated verification for human
confirmation of the profile and creator-name flow before beginning Phase 2.

---

## Phase 2: Stabilize expense review presentation

### Overview

Ensure review failures do not distort mobile controls and make declined-card
reason text self-explanatory.

### Changes Required

#### 1. Responsive approval-error action layout

**File**: `src/components/expenses/ExpenseList.astro`

**Intent**: Keep Approve and Decline at their natural button height when an
approval attempt fails, while making the message clear for the entire action
set.

**Contract**: The review action group prevents cross-axis stretching and the
dynamically inserted alert spans beneath both action buttons at narrow and wide
viewport widths. Existing background approval and refresh behavior remains
unchanged.

#### 2. Decline-reason label

**File**: `src/components/expenses/ExpenseList.astro`

**Intent**: Distinguish a decline reason from general expense-card content.

**Contract**: When `declineReason` is present, render a visible `Decline reason:`
label with its value in the declined-expense card; omit the field entirely when
there is no reason.

### Success Criteria

#### Automated Verification

- `npm run lint` passes.
- `npm test` passes with existing expense-domain tests unaffected.

#### Manual Verification

- On a phone-width viewport, force an approval conflict and verify both action
  buttons retain normal height while the error appears beneath them.
- Decline an expense and verify its declined card clearly labels the reason.

**Implementation Note**: Pause after automated verification for human
confirmation of the mobile review layout and declined-card copy before
beginning Phase 3.

---

## Phase 3: Clarify dashboard settlement and navigation actions

### Overview

Remove the non-actionable current-month settlement CTA from the dashboard and
make the desktop navigation controls use the available sidebar width.

### Changes Required

#### 1. Current-month settlement presentation

**Files**: `src/components/expenses/MonthlyBalancePanel.astro`,
`src/lib/expense-balance.test.ts`

**Intent**: Avoid offering an action that the domain rules already reject for
the dashboard's current month.

**Contract**: When settlement state is unavailable only because of
`current-month`, render the explanatory state without `SettlementConfirmationDialog`.
Preserve the existing disabled CTA for other unavailable reasons and preserve
historical report behavior.

#### 2. Full-width desktop navigation controls

**File**: `src/components/DashboardNavigation.astro`

**Intent**: Align Report history, Recurring expenses, and Sign out with the
full desktop sidebar width.

**Contract**: Each desktop-only navigation control fills its menu container
without changing the existing mobile drawer behavior, labels, routes, or form
submission.

### Success Criteria

#### Automated Verification

- `npm test` passes, including settlement-state boundary coverage.
- `npm run lint` and `npm run build` pass.

#### Manual Verification

- On the dashboard's current month, the settlement explanation is visible and
  no Confirm settlement button is rendered.
- For a past unavailable month, the existing disabled settlement CTA remains.
- On a desktop viewport, all three navigation controls span the sidebar width;
  mobile navigation remains usable.

**Implementation Note**: Pause after automated verification for human
confirmation of the dashboard and desktop-navigation behavior before closing
the change.

## Testing Strategy

### Unit Tests

- Display-name trim/length validation, safe error mapping, and expense-row
  parsing with payer names.
- Existing settlement state tests extended only for the current-month
  presentation boundary.

### Database Tests

- New members require valid display names through creation/join RPCs.
- An active unnamed parent can set only their own display name once; direct
  mutation, subsequent changes, and anonymous execution remain denied.
- Co-parent names are readable only through the existing family-scoped RLS
  boundary.

### Manual Testing Steps

1. Create a new account with a valid name, create or join a family, and verify
   the menu and expense creator labels.
2. Sign in with an existing unnamed account, complete the required name form,
   then refresh and verify current labels remain unchanged.
3. Check the mobile approval-error layout and labelled decline reason.
4. Check the dashboard current-month settlement state and desktop/menu widths.

## Performance Considerations

The expense query adds one family-member relationship already constrained by
the payer foreign key. A display-name update is a single membership-row write;
no historical expense records are rewritten.

## Migration Notes

The forward-only migration leaves existing names null so it can apply without
inventing identity data. The application gate completes those accounts on their
next authenticated visit. Rolling back UI code leaves the harmless nullable
column and RPC in place; removal would require a separate forward migration.

## References

- Requirements: `context/changes/ux-changes/requirments.md`
- Expense cards and approval feedback: `src/components/expenses/ExpenseList.astro`
- Settlement state: `src/lib/expense-balance.ts`
- Dashboard navigation: `src/components/DashboardNavigation.astro`
- Family identity and RLS: `supabase/migrations/20260717160000_financial_rules_foundation.sql`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Establish parent display names

#### Automated

- [x] 1.1 Add display-name migration, RPCs, and database authorization tests — f47670e
- [x] 1.2 Add display-name client validation, profile API, and unit tests — f47670e
- [x] 1.3 Capture and complete parent names in signup and navigation — f47670e
- [x] 1.4 Show creator names in active and declined expense cards — f47670e
- [x] 1.5 Run database, unit, and lint verification — f47670e

#### Manual

- [x] 1.6 Verify new and existing-user name completion, fixed names, and creator labels — f47670e

### Phase 2: Stabilize expense review presentation

#### Automated

- [x] 2.1 Prevent review actions from stretching when approval fails
- [x] 2.2 Label decline reasons in declined expense cards
- [x] 2.3 Run unit and lint verification

#### Manual

- [x] 2.4 Verify mobile approval-error layout and decline-reason clarity

### Phase 3: Clarify dashboard settlement and navigation actions

#### Automated

- [ ] 3.1 Hide the current-month settlement CTA only on the dashboard
- [ ] 3.2 Make desktop navigation controls full width
- [ ] 3.3 Run unit, lint, and production-build verification

#### Manual

- [ ] 3.4 Verify current-month settlement, past-month behavior, and responsive navigation
