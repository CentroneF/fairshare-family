---
project: "FairShare Family"
version: 1
status: draft
created: 2026-07-15
context_type: greenfield
product_type: web-app
target_scale:
  users: medium
  qps: null
  data_volume: null
timeline_budget:
  mvp_weeks: 5
  hard_deadline: null
  after_hours_only: true
---

## Vision & Problem Statement

Separated or divorced co-parents do not track their shared child expenses, so at the end of the month neither parent has a reliable view of how much each person spent. This creates coordination problems, complaints, and conflict when either parent believes they paid more than the other.

Structured expense entry and automatic monthly reports make recording and reviewing shared costs easier than using a spreadsheet.

## User & Persona

The primary persona is a separated or divorced co-parent who shares responsibility for a child's expenses with the other parent. They need the product at the end of the month, when both parents want to understand their spending and settle any imbalance without conflict.

## Success Criteria

### Primary

- Within a family, parents can record and review expenses, approve or decline each other's expenses, view current and historical monthly reports, determine the balance to exchange, and mark a report `SETTLED` only with both parents' agreement.

### Secondary

- Parents can configure recurring monthly expenses.

### Guardrails

- Expense balances and monthly reports remain financially accurate.
- Neither parent can mark a report `SETTLED` unilaterally.

The MVP is estimated at five weeks of after-hours work at roughly two to three hours per day, with no hard deadline.

## User Stories

### US-01: Approved expense contributes to the monthly balance

- **Given** two co-parents belong to the same family
- **When** one parent adds an expense and the other parent approves it
- **Then** the expense is included in that month's expense list, final report, and calculated balance

#### Acceptance Criteria

- A declined expense remains visible in the monthly expense list.
- A declined expense is excluded from the final report and calculated balance.
- The MVP provides no expense notifications, dispute workflow, or comments.

## Functional Requirements

### Accounts

- FR-001: A co-parent can create an account. Priority: must-have
  > Socrates: Counter-argument considered: standalone account creation could be redundant or too costly for the MVP. Resolution: kept as written.
- FR-002: A co-parent can log in using email and password and remain logged in until they explicitly log out. Priority: must-have
  > Socrates: Counter-argument considered: repeated login would create unnecessary friction for two known co-parents. Resolution: revised to require a long-lived session that ends only through explicit logout.

### Family

- FR-003: A co-parent can create a family when their account is not already associated with one; each account can belong to only one family. Priority: must-have
  > Socrates: Counter-argument considered: family creation could imply multi-family membership and management. Resolution: narrowed the MVP to one family per account.
- FR-004: A co-parent can add children's names to the family. Priority: must-have
  > Socrates: Counter-argument considered: children's names are sensitive and requiring them may delay the first expense. Resolution: kept as written.
- FR-005: A family creator can invite the second parent by sharing a simple family join code. Priority: must-have
  > Socrates: Counter-argument considered: delivered invitations and expiration rules add work, while blocking expense entry until the second parent joins delays value. Resolution: replaced delivery with a simple join code and allowed the creator to begin tracking expenses before the second parent joins.

### Expenses

- FR-006: A co-parent can create an expense with a description, child or N/A, and amount; expenses entered before the second parent joins remain pending for their later review. Priority: must-have
  > Socrates: Counter-argument considered: mandatory approval may create a pending backlog, and pre-join expenses may produce a temporarily one-sided view. Resolution: kept as revised.
- FR-007: A co-parent can edit an expense only while its monthly report is unsettled; the edited amount is removed from the approved total and added to `to_review_amount` until the other parent reviews it. Priority: must-have
  > Socrates: Counter-argument considered: editing an approved expense could silently invalidate the report or require revision history. Resolution: limited edits to unsettled reports and moved edited amounts out of the approved total until re-approved.
- FR-008: A co-parent can delete only expenses they entered, without approval, and only while the monthly report is unsettled. Priority: must-have
  > Socrates: Counter-argument considered: unilateral deletion changes the shared balance, and deletion from settled reports would undermine locked history. Resolution: retained unilateral deletion of one's own expenses but prohibited it after settlement.
- FR-009: A co-parent can approve or decline expenses created or edited by the other parent. Priority: must-have
  > Socrates: Counter-argument considered: a parent can stall the report by refusing review, and declines have no in-app explanation or resolution path. Resolution: kept as written for the MVP.
- FR-010: A co-parent can configure recurring monthly expenses, with each monthly occurrence requiring approval from the other parent. Priority: nice-to-have
  > Socrates: Counter-argument considered: recurrence adds scheduling scope and could bypass or repeat the approval burden. Resolution: retained as nice-to-have and required fresh approval for every monthly occurrence.

### Reporting and settlement

- FR-011: A co-parent can view the current month's balance, including separate total, approved, and `to_review` amounts and whether they owe or are owed money. Priority: must-have
  > Socrates: Counter-argument considered: a current-month report could make provisional totals look final or duplicate the expense list. Resolution: reframed it as a balance view with approved and pending amounts shown separately.
- FR-012: A co-parent can view previous months in a history that clearly distinguishes settled months from unsettled months. Priority: must-have
  > Socrates: Counter-argument considered: history may duplicate the selected-month view and mix provisional with final balances. Resolution: retained history and required clear settled versus unsettled status.
- FR-013: A co-parent can view expenses for a selected month, with declined expenses retained at the end of the list. Priority: must-have
  > Socrates: Counter-argument considered: retained declined expenses may clutter the list, and a separate list may duplicate the monthly view. Resolution: retained the list and placed declined expenses at the end.
- FR-014: Both co-parents can jointly settle and lock a past monthly report only when no pending or declined expenses remain; a declined expense must be edited and re-approved or deleted by its creator. Priority: must-have
  > Socrates: Counter-argument considered: joint agreement can leave a month unsettled indefinitely, while permanent locking prevents later corrections. Resolution: kept as written.

## Non-Functional Requirements

- Only authenticated accounts invited into a family can see that family's children, expenses, and reports.
- The MVP supports PLN only, stored and calculated with exactly two decimal places.
- Calculations use exact expense amounts; only the final amount owed is rounded to the nearest whole unit, with `.50` rounded upward.
- The product is responsive across screen sizes and can be installed as a PWA on Android.

## Business Logic

The app splits every approved expense 50/50, calculates which parent owes the difference, and allows a month to be settled only when no pending or declined expenses remain; declined expenses must be edited and re-approved or deleted by their creator.

The rule consumes each expense's amount, paying parent, and approval status. Pending amounts remain separate in `to_review_amount` until resolved, while declined expenses do not contribute to the settlement calculation.

Parents encounter the rule in the monthly balance, which shows total, approved, and `to_review` amounts and identifies which parent owes or is owed money.

## Access Control

Each parent signs in using an email address and password and remains signed in until explicitly logging out. One parent creates a family and shares a simple join code with the other parent. Each account can belong to only one family, and both parents have equal permissions within it. Only authenticated accounts invited into the family can access its children, expenses, and reports.

The family creator may enter expenses before the second parent joins; those expenses remain pending for later review. Creating or editing an expense requires approval from the other parent. Editing is allowed only while the monthly report is unsettled and moves the amount out of the approved total into `to_review_amount` until re-approved. A parent may delete only an expense they entered, without approval, and only while the monthly report is unsettled.

A report can be settled and locked only with both parents' agreement and only when no pending or declined expenses remain.

## Non-Goals

- No expense notifications in the MVP.
- No in-app expense dispute workflow in the MVP.
- No comments on expenses in the MVP.
- No custom split ratios; every approved expense uses the fixed 50/50 rule.
- No families with more than two co-parents, and no account associated with multiple families.
- No in-app money transfer; the product calculates and records settlement only.
- No native mobile application; Android installation uses the PWA.
- No explicit response-time target for the MVP.

## Open Questions

1. **What transaction-volume ballpark should the live product support?** — Owner: user. Resolve before tech-stack selection. Block: no.
2. **What expense-data volume should the live product support?** — Owner: user. Resolve before tech-stack selection. Block: no.
