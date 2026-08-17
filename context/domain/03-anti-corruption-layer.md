---
title: "FairShare Family — Money Anti-Corruption Layer"
created: 2026-08-11
type: refactor-plan
---

# FairShare Family — Money Anti-Corruption Layer

## Scope and discovery

This is a refactoring plan only. It proposes no production-code change and treats the database as the authoritative write boundary already established by the project.

### Product, stack, and layers

FairShare Family must keep expense balances and monthly reports financially accurate ([PRD](../foundation/prd.md:40)). It supports PLN only, stores and calculates source amounts to exactly two decimals, and rounds only the final amount owed to whole PLN with `.50` upward ([PRD](../foundation/prd.md:104)). The stack is Astro 6, React 19, TypeScript, Tailwind, Supabase, and Cloudflare Workers ([README](../../README.md:9)); the direct runtime dependencies include both `decimal.js` and Supabase SDKs ([package.json](../../package.json:23)).

Runtime dependencies are Astro integrations/framework, Radix Slot, Supabase SSR/client, Tailwind, React/React DOM, `decimal.js`, Lucide, and small styling utilities ([package.json](../../package.json:18)). Development dependencies are ESLint/Prettier tooling, Playwright, Supabase CLI, TypeScript, Vitest, and Wrangler ([package.json](../../package.json:39)). This review excludes build/lint/test tooling unless it enters a runtime domain contract.

The observable layers are:

| Layer                                      | Current locations                             | Role                                                                                                                           |
| ------------------------------------------ | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Delivery / UI                              | `src/pages/`, `src/components/`               | Astro pages render the balance and submit commands.                                                                            |
| HTTP boundary                              | `src/pages/api/`                              | Routes parse request data and call helpers, e.g. expense creation ([create route](../../src/pages/api/expenses/create.ts:20)). |
| Application and domain-adjacent logic      | `src/lib/`                                    | Financial calculation, normalization, workspace mapping, and repository seams.                                                 |
| Infrastructure / authoritative persistence | `src/lib/supabase.ts`, `supabase/migrations/` | Request-scoped Supabase client, PostgreSQL schema, RLS, and RPC commands.                                                      |
| Tests                                      | `src/lib/*.test.ts`, `supabase/tests/`        | Unit and database proof.                                                                                                       |

No inspected base document says that Supabase, `decimal.js`, or another component is deliberately replaceable. The relevant declared intent is instead behavioural: exact money and fixed rounding. Consequently, there is no verified intent-versus-code divergence to claim; the case for an ACL is preventing a library-specific money representation from becoming a product contract.

## 1. Identified dependencies and classification

The package manifest contains framework/UI packages, presentation-only utilities, Supabase, and `decimal.js` ([package.json](../../package.json:18)). Only the following dependencies show a material layer-boundary leak.

| Dependency                                | Verified spread and signal                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Replacement risk/cost                                                                                                           | Replaceability declaration                                                                                | Assessment                                                                                                                                                                                                                                                           |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`decimal.js`**                          | Domain-facing `MonthlyBalance` exposes `Decimal` in its public signature ([financial rules](../../src/lib/financial-rules.ts:12)); the application service returns it ([financial service](../../src/lib/financial-service.ts:100)); the read mapper reconstructs it ([expense balance](../../src/lib/expense-balance.ts:221)); the UI calls its methods ([balance panel](../../src/components/expenses/MonthlyBalancePanel.astro:14)); and a test must construct its objects ([test](../../src/lib/expense-balance.test.ts:316)). | **Medium:** five implementation/test/UI files must change today, but money is already string-shaped at database/API boundaries. | **None found.** The PRD declares exact monetary outcomes, not a particular arithmetic package.            | **Worst leak.** A vendor object is a domain return type and a UI rendering protocol.                                                                                                                                                                                 |
| `@supabase/supabase-js` / `@supabase/ssr` | Client types are passed through application helpers ([expense balance](../../src/lib/expense-balance.ts:1), [financial service](../../src/lib/financial-service.ts:1), [family onboarding](../../src/lib/family-onboarding.ts:1)) and an Astro component prop ([workspace](../../src/components/expenses/ExpenseWorkspace.astro:6)); the request client is infrastructural ([Supabase helper](../../src/lib/supabase.ts:1)).                                                                                                       | **High:** replacing it also replaces PostgreSQL/RLS/RPC deployment architecture.                                                | **None found.** README explicitly selects Supabase as the backend service ([README](../../README.md:77)). | A real infrastructure boundary problem, but not the first ACL target: it is a platform integration and its type-only UI imports are erased from the browser bundle. Address it later with repositories/use-cases, without pretending a money ACL swaps the database. |
| Astro / React / Radix / Lucide / Tailwind | Imports are confined to delivery/UI/framework concerns (for example, the button imports React only in a UI component; [button](../../src/components/ui/button.tsx:1)).                                                                                                                                                                                                                                                                                                                                                             | Low to high depending on framework, but no cross-domain object contract was found.                                              | None found.                                                                                               | Not a dependency leak under this review.                                                                                                                                                                                                                             |

For completeness, the explicit Supabase-package import/type sites are [`src/lib/supabase.ts`](../../src/lib/supabase.ts:1), [`src/env.d.ts`](../../src/env.d.ts:3), [`src/lib/expense-balance.ts`](../../src/lib/expense-balance.ts:1), [`src/lib/financial-service.ts`](../../src/lib/financial-service.ts:1), [`src/lib/family-onboarding.ts`](../../src/lib/family-onboarding.ts:1), and [`src/components/expenses/ExpenseWorkspace.astro`](../../src/components/expenses/ExpenseWorkspace.astro:6). The request-client consumers that consequently know the Supabase-shaped `locals.supabase` contract are [`src/middleware.ts`](../../src/middleware.ts:2), [`src/lib/config-status.ts`](../../src/lib/config-status.ts:1), the three auth routes ([signin](../../src/pages/api/auth/signin.ts:8), [signout](../../src/pages/api/auth/signout.ts:4), [signup](../../src/pages/api/auth/signup.ts:8)), the five expense routes ([approve](../../src/pages/api/expenses/approve.ts:6), [create](../../src/pages/api/expenses/create.ts:11), [decline](../../src/pages/api/expenses/decline.ts:6), [delete](../../src/pages/api/expenses/delete.ts:6), [edit](../../src/pages/api/expenses/edit.ts:15)), the five family routes ([children](../../src/pages/api/family/children.ts:5), [create](../../src/pages/api/family/create.ts:5), [join confirm](../../src/pages/api/family/join/confirm.ts:5), [join preview](../../src/pages/api/family/join/preview.ts:5), [regenerate](../../src/pages/api/family/regenerate-code.ts:5)), the settlement route ([confirm](../../src/pages/api/settlements/confirm.ts:6)), and the four server pages ([dashboard](../../src/pages/dashboard.astro:10), [new expense](../../src/pages/expenses/new.astro:7), [reports](../../src/pages/reports.astro:7), [month report](../../src/pages/reports/[month].astro:7)). These sites are classified, not selected, evidence; they are deliberately not proposed as part of the money ACL.

### Chosen #1: `decimal.js`

`decimal.js` wins because its _representation_, not merely its implementation, crosses all relevant internal boundaries: financial rules create it, application services return it, read mapping reconstructs it, UI calls its instance methods, and tests manufacture it. Supabase has a larger replacement cost, but that cost follows a deliberate backend choice and its package imports do not cross into hydrated client code here: `ExpenseWorkspace.astro` uses `import type`, which TypeScript removes ([workspace](../../src/components/expenses/ExpenseWorkspace.astro:6)). By contrast, choosing a different decimal library would require touching financial calculations, read mapping, tests, and presentation despite none of those layers needing to know an arbitrary-precision object API. The PRD's exactness requirement makes this a core-domain concern, so coupling it to `Decimal.plus`, `greaterThan`, `toDecimalPlaces`, and `toFixed` is a costly and unnecessary vendor-shaped domain contract.

## 2. Diagnosis

### All files that know `decimal.js` today

“Knows” includes a direct package import and consumption of the library object propagated from another layer. The package manifest and lockfile necessarily name an installed dependency; they are configuration, not application-layer consumers.

| File                                                                                                              | How it knows the dependency today                                                                                                                                                                                         |
| ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`src/lib/financial-rules.ts`](../../src/lib/financial-rules.ts:1)                                                | Direct import; exports `Decimal` fields and returns one from `parsePlnAmount` ([11-33](../../src/lib/financial-rules.ts)).                                                                                                |
| [`src/lib/financial-service.ts`](../../src/lib/financial-service.ts:2)                                            | Direct import; exposes `Decimal` from `sumApprovedExpenseAmounts` ([100-105](../../src/lib/financial-service.ts)).                                                                                                        |
| [`src/lib/expense-balance.ts`](../../src/lib/expense-balance.ts:2)                                                | Direct import; rebuilds values from persistence and uses the library for display rounding ([216-228](../../src/lib/expense-balance.ts), [424-443](../../src/lib/expense-balance.ts)).                                     |
| [`src/components/expenses/MonthlyBalancePanel.astro`](../../src/components/expenses/MonthlyBalancePanel.astro:13) | No direct import, but calls the leaked object's `greaterThan` and `toFixed` methods ([14-20](../../src/components/expenses/MonthlyBalancePanel.astro), [51-59](../../src/components/expenses/MonthlyBalancePanel.astro)). |
| [`src/lib/expense-balance.test.ts`](../../src/lib/expense-balance.test.ts:1)                                      | Direct import; fixtures must construct the same vendor values ([315-329](../../src/lib/expense-balance.test.ts)).                                                                                                         |
| [`src/components/expenses/CreateExpenseForm.astro`](../../src/components/expenses/CreateExpenseForm.astro:118)    | Does not import the package, but independently uses `Number(amount) > 0` for a money input check. This is a second arithmetic representation at the UI edge and can diverge from the exact-string parser.                 |
| [`package.json`](../../package.json:31) and [`package-lock.json`](../../package-lock.json:25)                     | Dependency declaration and resolved installation metadata; these will remain only while the chosen adapter uses the library.                                                                                              |

### Duplicated shapes and boundary leaks

The public domain-facing shape is vendor-shaped:

```ts
// src/lib/financial-rules.ts:11-18
interface MonthlyBalance {
  totalAmount: Decimal;
  approvedAmount: Decimal;
  toReviewAmount: Decimal;
  contributions: ReadonlyMap<string, Decimal>;
  settlement: {
    /* ... amount: Decimal ... */
  };
}
```

The application service then repeats the dependency in a second public signature:

```ts
// src/lib/financial-service.ts:100-105
export function sumApprovedExpenseAmounts(expenses: readonly FinancialExpenseRow[]): Decimal {
  return expenses.reduce(
    (total, expense) => (expense.status === "approved" ? total.plus(parsePlnAmount(expense.amount_pln)) : total),
    new Decimal(0),
  );
}
```

The UI is forced to act as a `Decimal` consumer instead of receiving ready display data:

```ts
// src/components/expenses/MonthlyBalancePanel.astro:14-20, 51-59
const hasPendingExpenses = balance.toReviewAmount.greaterThan(0);
// ... balance.settlement.amount.toFixed(0)
// ... balance.totalAmount.toFixed(2)
```

The read mapper makes a third reconstruction of the library object from a persistence value:

```ts
// src/lib/expense-balance.ts:216-228
const amount = new Decimal(raw);
return amount.isFinite() && amount.greaterThanOrEqualTo(0) && amount.decimalPlaces() <= 2 ? amount.toFixed(2) : null;
```

This is not a server-package-in-browser-bundle finding: the balance panel is an `.astro` server-rendered component, and its problem is the presentation contract, not bundle inclusion. The dangerous consequence is still real: any substitute must emulate an undocumented subset of `Decimal` methods in the UI and test fixtures, and a future client-island reuse would carry the arithmetic package solely because a view was given an object rather than strings/booleans.

### Contract decisions resolved from the installed library documentation

Two library contracts matter and must be deliberately encoded in the ACL rather than left implicit in the API/UI:

1. `decimal.js` documents that constructor precision is significant-digit based ([local package README](../../node_modules/decimal.js/README.md:28)) and calculations obey constructor precision/rounding configuration ([local package README](../../node_modules/decimal.js/README.md:175)). The adapter must create one private configured constructor—never mutate/use an ambient default—and set a documented precision sufficient for persisted `numeric(12,2)` values and balance arithmetic. The exact precision value is an implementation decision to test in the adapter; it is not an HTTP contract.
2. The library advises strings for values beyond a few digits to avoid JavaScript-number loss ([local package README](../../node_modules/decimal.js/README.md:81)) and documents that `toFixed` avoids exponential notation ([local package README](../../node_modules/decimal.js/README.md:152)). The ACL must accept persistence/API money as canonical decimal strings, reject non-finite/over-two-decimal source amounts, and emit fixed-scale strings. It must never construct money from `number`; the UI's `Number(amount)` check becomes only non-authoritative browser convenience or is replaced by the same string grammar.

The PRD's `.50`-up rule ([PRD](../foundation/prd.md:105)) is therefore encoded once as `roundToWholePlnHalfUp()` in the money ACL. No route, DTO, UI component, or SQL response mapper is allowed to select a decimal rounding mode.

## 3. ACL design

### Target ownership and permitted dependency knowledge

Create one explicit ACL directory. The package name may occur in only its concrete adapter (and its focused adapter test) under this directory:

```text
src/
  domain/
    money/
      Money.ts                   # vendor-neutral value object and port
      MoneyView.ts               # primitive presentation contract
  infrastructure/
    acl/
      money/
        DecimalJsMoneyAdapter.ts # the only production import of decimal.js
        DecimalJsMoneyAdapter.test.ts
```

`Money` is the domain value object; it owns PLN validity, scale, addition/subtraction/comparison, and the final half-up settlement operation. Its representation is opaque outside the module. The concrete adapter is part of the money ACL and is the only code that knows `Decimal` construction, method names, configuration, and persistence conversion; domain callers know only the narrow `MoneyArithmetic` port.

```ts
// src/domain/money/Money.ts — vendor-neutral public contract
declare const moneyBrand: unique symbol;
export type Money = Readonly<{ readonly [moneyBrand]: "PLN" }>;

export interface MoneyArithmetic {
  fromInput(value: string): Money; // positive, scale <= 2
  fromPersistence(value: string): Money; // non-negative, scale <= 2
  zero(): Money;
  add(left: Money, right: Money): Money;
  subtract(left: Money, right: Money): Money;
  compare(left: Money, right: Money): -1 | 0 | 1;
  abs(value: Money): Money;
  divideByTwo(value: Money): Money;
  roundToWholePlnHalfUp(value: Money): Money;
  toPersistence(value: Money): string; // fixed two decimals
  toDisplay(value: Money): string; // fixed two decimals
  toWholePlnDisplay(value: Money): string; // integer display
}

export interface MoneyView {
  formatted: string; // e.g. "10.50"
  isPositive: boolean;
}
```

`Money` is intentionally opaque: no caller can reach `.plus`, `.toFixed`, `.d`, precision, or rounding configuration. Domain calculations receive a `MoneyArithmetic` instance through composition (or an application composition root), and return domain results containing `Money`, never a `Decimal` type.

### Concrete adapter pseudocode

```ts
// src/infrastructure/acl/money/DecimalJsMoneyAdapter.ts
import Decimal from "decimal.js";

const DecimalPln = Decimal.clone({
  precision: /* documented and adapter-tested value */,
  rounding: Decimal.ROUND_HALF_UP,
});

export class DecimalJsMoneyAdapter implements MoneyArithmetic {
  fromInput(raw: string): Money {
    const normalized = raw.trim().replace(",", ".");
    assertMatchesPositivePlnGrammar(normalized);          // no JS number coercion
    return brand(new DecimalPln(normalized));
  }

  fromPersistence(raw: string): Money {
    assertMatchesNonNegativeTwoDecimalPlnGrammar(raw);
    const decimal = new DecimalPln(raw);
    if (!decimal.isFinite() || decimal.decimalPlaces() > 2) throw new InvalidPersistedMoney();
    return brand(decimal);
  }

  add(a: Money, b: Money): Money { return brand(unbrand(a).plus(unbrand(b))); }
  subtract(a: Money, b: Money): Money { return brand(unbrand(a).minus(unbrand(b))); }
  compare(a: Money, b: Money): -1 | 0 | 1 { return sign(unbrand(a).cmp(unbrand(b))); }
  abs(a: Money): Money { return brand(unbrand(a).abs()); }
  divideByTwo(a: Money): Money { return brand(unbrand(a).div(2)); }
  roundToWholePlnHalfUp(a: Money): Money {
    return brand(unbrand(a).toDecimalPlaces(0, DecimalPln.ROUND_HALF_UP));
  }
  toPersistence(a: Money): string { return unbrand(a).toFixed(2); }
  toDisplay(a: Money): string { return unbrand(a).toFixed(2); }
  toWholePlnDisplay(a: Money): string { return unbrand(a).toFixed(0); }
}
```

The adapter's `brand`/`unbrand` functions are private. `Decimal` never appears in a port, a DTO, an API response, an Astro prop, a test fixture outside the adapter tests, or a database contract.

### Domain use and presentation shape

The financial rule changes from vendor operations to named money operations. The 50/50 rule remains exactly the same business rule; only its arithmetic collaborator changes.

```ts
// domain service pseudocode
function deriveMonthlyBalance(expenses, parentIds, money: MoneyArithmetic): MonthlyBalance {
  let approved = money.zero();
  let toReview = money.zero();
  const contributions = new Map(parentIds.map((id) => [id, money.zero()]));

  for (const expense of expenses) {
    const amount = money.fromPersistence(expense.amountPln);
    if (expense.status === "approved") {
      /* add to payer and approved */
    }
    if (expense.status === "pending") toReview = money.add(toReview, amount);
  }

  const net = money.subtract(firstContribution, money.divideByTwo(approved));
  const settlement = money.roundToWholePlnHalfUp(money.abs(net));
  return { approved, toReview, total: money.add(approved, toReview), settlement /* ... */ };
}

// application presenter / view model pseudocode
function toMonthlyBalanceView(balance, currentMembershipId, money: MoneyArithmetic) {
  return {
    totalAmount: money.toDisplay(balance.total),
    approvedAmount: money.toDisplay(balance.approved),
    toReviewAmount: money.toDisplay(balance.toReview),
    hasPendingExpenses: money.compare(balance.toReview, money.zero()) > 0,
    settlement: {
      kind: balance.settlement.kind,
      amount: money.toWholePlnDisplay(balance.settlement.amount),
      /* payer-direction primitives only */
    },
  };
}
```

The UI receives `MonthlyBalanceView` strings and booleans. It renders `{balance.totalAmount} PLN` and branches on `hasPendingExpenses`; it neither calls a money method nor imports/infers a vendor object. API routes continue accepting raw form strings and return/display primitive values only. Persistence adapters convert PostgreSQL `numeric` response strings via `fromPersistence` and persist through `toPersistence`; table column types, RPC argument text values, and response JSON remain unchanged.

## 4. Proof of isolation and before/after

### What changes when the arithmetic library is swapped

| Concern                           | Changes for `decimal.js` → alternative                                                                                         | Does not change                                                                            |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| Concrete arithmetic/configuration | `src/infrastructure/acl/money/DecimalJsMoneyAdapter.ts` and its adapter tests; eventually the dependency declaration/lockfile. | `Money` public contract.                                                                   |
| Database mapping                  | Only the ACL adapter's `fromPersistence` / `toPersistence` conversion.                                                         | PostgreSQL tables, migrations, RLS policies, RPC names, and `numeric(12,2)` data contract. |
| Financial domain logic            | No change if the `MoneyArithmetic` semantics and adapter conformance tests hold.                                               | 50/50 split, approved/pending/declined rules, and final `.50`-up policy.                   |
| Application / API                 | No change beyond wiring the alternate adapter at the composition root.                                                         | Form/API money strings and endpoint contracts.                                             |
| UI                                | No change.                                                                                                                     | `MonthlyBalanceView` primitive fields and rendered PLN labels.                             |

That proof is conditional on one rule: `Money`, `MoneyArithmetic`, and view DTOs must never expose the concrete numeric object. It does **not** claim Supabase is now swappable; that is separate infrastructure work.

### Before → after ownership

| Current file                   | Before                                                                                             | After                                                                                                                                         |
| ------------------------------ | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/financial-rules.ts`   | `MonthlyBalance` publicly contains `Decimal`; business code invokes `Decimal` methods.             | Move/replace with vendor-neutral `Money` and `MoneyArithmetic`; the balance contains opaque money values only inside domain/application code. |
| `src/lib/financial-service.ts` | `sumApprovedExpenseAmounts` returns `Decimal`; a repository and mapping service share the package. | Repository returns string row values; domain service consumes the port; no library return type.                                               |
| `src/lib/expense-balance.ts`   | Reconstructs `new Decimal(raw)` in two read paths.                                                 | Persistence/read mapper calls the ACL's `fromPersistence`, then a presenter emits strings.                                                    |
| `MonthlyBalancePanel.astro`    | Calls `.greaterThan()` and `.toFixed()` on leaked values.                                          | Receives ready `MonthlyBalanceView`: fixed strings plus `hasPendingExpenses`.                                                                 |
| `expense-balance.test.ts`      | Creates `new Decimal(...)` to build a balance fixture.                                             | Uses a test money factory or primitive view fixture; direct `decimal.js` tests are confined to the adapter test.                              |
| `CreateExpenseForm.astro`      | Uses `Number(amount)` as independent money logic.                                                  | Performs only user-experience checks based on the shared string grammar, while server/domain validation remains authoritative.                |

### Files that will no longer know the package

After the refactor, `decimal.js` must be absent from these current consumers: `src/lib/financial-rules.ts`, `src/lib/financial-service.ts`, `src/lib/expense-balance.ts`, `src/components/expenses/MonthlyBalancePanel.astro`, and `src/lib/expense-balance.test.ts`. `CreateExpenseForm.astro` has no package import today, but its independent numeric coercion must also be removed/reduced so it no longer embodies a competing arithmetic model. The only application-source matches may be `src/infrastructure/acl/money/DecimalJsMoneyAdapter.ts` and `src/infrastructure/acl/money/DecimalJsMoneyAdapter.test.ts`; `package.json` and `package-lock.json` will still name an installed package by necessity until the dependency is removed. Historical plans/docs (including this evidence document) also retain the text for auditability and must be excluded from a source-isolation grep.

The executable success check is therefore deliberately scoped to implementation source rather than dependency metadata/history:

```sh
rg -n "decimal\.js" src --glob '!infrastructure/acl/money/**'
# Expected: no matches

rg -n "decimal\.js" src/infrastructure/acl/money
# Expected: only DecimalJsMoneyAdapter.ts and DecimalJsMoneyAdapter.test.ts
```

If the replacement removes `decimal.js` completely, the second command also returns no matches after removing the manifest entry. A literal repository-wide grep cannot be a correct success criterion while `package.json`, `package-lock.json`, and this audit document truthfully mention the dependency.

## 5. Phased plan and verification

1. **Characterise exact money semantics.** Add vendor-neutral unit tests for accepted/rejected PLN strings, fixed two-decimal persistence/display values, non-finite rejection, addition/subtraction/comparison, and the PRD's final whole-PLN half-up examples. Add adapter conformance tests that exercise the installed library's private configuration. Do not change routes or SQL.
2. **Introduce the ACL and opaque money contract.** Add `Money`, `MoneyArithmetic`, `MoneyView`, and `DecimalJsMoneyAdapter`; wire it only in the server composition root. Move all direct `Decimal` construction/configuration into the adapter, then remove `Decimal` from public financial signatures.
3. **Refactor financial rules and read mapping.** Convert `financial-rules`, `financial-service`, and `expense-balance` incrementally to use the port and persistence mapping. Preserve database text/numeric wire values and existing Supabase/RLS authority; reject malformed persisted numeric data fail-fast rather than silently coercing it.
4. **Replace UI object consumption.** Introduce `MonthlyBalanceView`, update Astro props/rendering to strings and booleans, and replace `Number(amount)` client validation with the shared input grammar or a simple non-authoritative check. Add component/view-model tests proving the UI cannot require a `Decimal` instance.
5. **Prove isolation and regressions.** Move any remaining direct library fixtures into focused ACL tests; run both source-isolation greps above, `npm test`, and `npm run verify`. Because this plan changes TypeScript application code but not migrations/RLS, `npx supabase test db` is not required for the ACL alone; run it if a concurrent change touches persistence contracts.

## Summary

`decimal.js` is the most harmful discovered dependency leak because its object type is exported by financial rules, returned by services, reconstructed by read mapping, and consumed directly by the UI. Supabase is broadly coupled but is an explicitly selected backend platform whose imports are server-side/type-only at the observed UI seam, so it is not the first ACL target. The PRD does not promise a replaceable library, but it does require exact two-decimal PLN arithmetic and final half-up rounding, making vendor-neutral money semantics essential. The proposed `Money` value object and narrow `MoneyArithmetic` port isolate the concrete library in one money ACL adapter. UI receives fixed strings and booleans, while persistence continues using stable string/numeric values and APIs never expose a numeric-library object. Swapping arithmetic libraries will then change only the adapter, adapter tests, and dependency metadata—not tables, RPCs, API contracts, financial rules, or components. Verification combines behavioural money tests with a source-scoped grep proving that application imports of `decimal.js` exist only in the ACL directory.
