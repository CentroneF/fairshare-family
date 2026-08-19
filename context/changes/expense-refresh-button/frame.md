# Frame Brief: Expense refresh button

> Framing step before /10x-plan. This document captures what is *actually*
> at issue, separated from what was initially assumed.

## Reported Observation

Clicking the Refresh button in the expense list produces no visible button-state change, no network call, and no workspace update.

## Initial Framing (preserved)

- **User's stated cause or approach**: No cause was proposed.
- **User's proposed direction**: Restore the refresh control's expected behavior.
- **Pre-dispatch narrowing**: The button does not change to “Refreshing…” and the browser records no network request.

## Dimension Map

The observation could originate at any of these dimensions:

1. **Client event delivery** — the delegated submit listener is absent or its script did not execute.
2. **Form matching** — the submitted form does not match the `data-refresh-expenses` selector used by the listener.
3. **Workspace hook availability** — the listener runs but cannot call the global workspace refresh function.
4. **Workspace response/replacement** — the hook fetches the page but cannot find or replace its target containers.

## Hypothesis Investigation

| Hypothesis | Evidence | Verdict |
| --- | --- | --- |
| Client event delivery | The listener changes button text synchronously before any async call, yet the user observes no label change. `src/components/expenses/ExpenseList.astro:208-220` | STRONG |
| Form matching | The refresh form has the exact `data-refresh-expenses` attribute tested by the listener. `src/components/expenses/ExpenseList.astro:49`, `208-210` | NONE |
| Workspace hook availability | A missing hook would occur after the listener changes the button label, which the user does not observe. `src/components/expenses/ExpenseList.astro:212-220` | NONE |
| Workspace response/replacement | Fetch/replacement also occurs after the synchronous label update. `src/components/expenses/ExpenseWorkspace.astro:104-120` | NONE |

## Narrowing Signals

- The button shows no transient “Refreshing…” state and no network request, ruling out a slow request or failed replacement as the primary observation.
- The form markup and delegated selector agree, so the likely fault is client-script delivery or execution rather than the HTML contract.

## Cross-System Convention

Interactive controls should have a working native form fallback when client-side event handling is unavailable. The present control relies on its client listener to prevent the native submit, so diagnosing script delivery is the first priority.

## Reframed (or Confirmed) Problem Statement

> **The actual problem to plan around is**: the expense-list refresh submit handler is not executing in the affected rendered page, so the UI never reaches its refresh logic.

The immediate symptom occurs before any network request or DOM replacement. The fix must establish why the client listener is not active and preserve a usable refresh path when scripting is unavailable.

## Confidence

- **HIGH** — the observed absence of the synchronous button-state change directly localizes the failure before the asynchronous refresh workflow.

## What Changes for /10x-plan

Plan the client-script delivery/rebinding fix and verify both the interactive refresh path and the native form fallback.

## References

- Source files: `src/components/expenses/ExpenseList.astro:49,208-224`
- Source files: `src/components/expenses/ExpenseWorkspace.astro:104-123`
