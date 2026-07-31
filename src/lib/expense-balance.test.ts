import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { loadMonthlyBalance } from "./financial-service";
import {
  deriveSettlementState,
  deriveMonthlyReportHistory,
  getSettlementUnavailableReason,
  isAccessibleHistoricalReportMonth,
  mapMonthlyReportHistoryRows,
  mapExpenseError,
  mapSettlementError,
  normalizeExpenseAmount,
  normalizeDeclineReason,
  normalizeExpenseDate,
  normalizeExpenseId,
  normalizeSelectedMonth,
  validateExpenseDateInMonth,
} from "./expense-balance";

describe("expense balance inputs", () => {
  it("normalizes comma or dot PLN decimals without number coercion", () => {
    expect(normalizeExpenseAmount("12,50")).toBe("12.50");
    expect(normalizeExpenseAmount("12.5")).toBe("12.50");
  });

  it("rejects invalid amounts and future dates", () => {
    expect(() => normalizeExpenseAmount("1,001")).toThrow();
    expect(() => normalizeExpenseDate("2026-07-23", new Date("2026-07-22T12:00:00Z"))).toThrow();
  });

  it("defaults to and restricts the selected month", () => {
    const today = new Date("2026-07-22T12:00:00Z");
    expect(normalizeSelectedMonth(null, today)).toBe("2026-07");
    expect(normalizeSelectedMonth("2026-06", today)).toBe("2026-06");
    expect(() => normalizeSelectedMonth("2026-08", today)).toThrow();
  });

  it("accepts only dates from the displayed month through today", () => {
    const today = new Date("2026-07-22T12:00:00Z");
    expect(validateExpenseDateInMonth("2026-07-01", "2026-07", today)).toBe("2026-07-01");
    expect(validateExpenseDateInMonth("2026-07-22", "2026-07", today)).toBe("2026-07-22");
    expect(validateExpenseDateInMonth("2026-06-01", "2026-06", today)).toBe("2026-06-01");
    expect(validateExpenseDateInMonth("2026-06-30", "2026-06", today)).toBe("2026-06-30");
    expect(() => validateExpenseDateInMonth("2026-06-30", "2026-07", today)).toThrow("displayed month");
    expect(() => validateExpenseDateInMonth("2026-07-23", "2026-07", today)).toThrow("future");
  });

  it("rejects missing, malformed, and invalid calendar dates before checking the displayed month", () => {
    const today = new Date("2026-07-22T12:00:00Z");
    expect(() => validateExpenseDateInMonth("", "2026-07", today)).toThrow("Enter an expense date.");
    expect(() => validateExpenseDateInMonth("2026/07/01", "2026-07", today)).toThrow("Enter an expense date.");
    expect(() => validateExpenseDateInMonth("2026-02-29", "2026-02", today)).toThrow("Enter a valid expense date.");
    expect(() => validateExpenseDateInMonth("2026-04-31", "2026-04", today)).toThrow("Enter a valid expense date.");
  });

  it("uses the same selected-month boundary for edited expense dates", () => {
    const today = new Date("2026-07-22T12:00:00Z");
    expect(validateExpenseDateInMonth("2026-06-15", "2026-06", today)).toBe("2026-06-15");
    expect(() => validateExpenseDateInMonth("2026-07-01", "2026-06", today)).toThrow("displayed month");
    expect(() => validateExpenseDateInMonth("2026-06-31", "2026-06", today)).toThrow("valid expense date");
  });

  it("validates approval IDs and maps safe approval errors", () => {
    expect(normalizeExpenseId("11111111-1111-4111-8111-111111111111")).toBe("11111111-1111-4111-8111-111111111111");
    expect(() => normalizeExpenseId("not-an-expense")).toThrow("no longer available");
    expect(mapExpenseError({ message: "Expense has already been reviewed" })).toBe(
      "This expense has already been reviewed.",
    );
    expect(mapExpenseError({ message: "Only the payer can update this expense" })).toBe(
      "Only the payer can edit this expense.",
    );
    expect(mapExpenseError({ message: "Expenses in a settled month cannot be updated" })).toBe(
      "Expenses in a confirmation-locked or settled month cannot be changed.",
    );
  });

  it("requires a concise decline reason", () => {
    expect(normalizeDeclineReason("  Duplicate charge  ")).toBe("Duplicate charge");
    expect(() => normalizeDeclineReason(" ")).toThrow("decline reason");
    expect(() => normalizeDeclineReason("x".repeat(501))).toThrow("decline reason");
  });

  it("loads exact approved and pending totals through the repository seam", async () => {
    const balance = await loadMonthlyBalance({
      repository: {
        listActiveParentIds: () => Promise.resolve(["parent-a", "parent-b"]),
        listMonthExpenses: () =>
          Promise.resolve([
            { amount_pln: "10.50", payer_id: "parent-a", status: "approved" },
            { amount_pln: "2.25", payer_id: "parent-b", status: "pending" },
            { amount_pln: "99.99", payer_id: "parent-a", status: "declined" },
          ]),
      },
      familyId: "family-a",
      userId: "user-a",
      month: "2026-07",
    });
    expect(balance.totalAmount.toFixed(2)).toBe("12.75");
    expect(balance.approvedAmount.toFixed(2)).toBe("10.50");
    expect(balance.toReviewAmount.toFixed(2)).toBe("2.25");
    expect(balance.settlement).toMatchObject({ kind: "payment", fromParentId: "parent-b", toParentId: "parent-a" });
  });

  it("moves an edited approved amount back into the review total", async () => {
    const balance = await loadMonthlyBalance({
      repository: {
        listActiveParentIds: () => Promise.resolve(["parent-a", "parent-b"]),
        listMonthExpenses: () => Promise.resolve([{ amount_pln: "10.50", payer_id: "parent-a", status: "pending" }]),
      },
      familyId: "family-a",
      userId: "user-a",
      month: "2026-07",
    });
    expect(balance.approvedAmount.toFixed(2)).toBe("0.00");
    expect(balance.toReviewAmount.toFixed(2)).toBe("10.50");
  });

  it("derives meaningful prior reports with exact approved totals and settlement status", () => {
    expect(
      deriveMonthlyReportHistory({
        currentMonth: "2026-07",
        expenses: [
          { expense_date: "2026-06-15", amount_pln: "10.25", payer_id: "parent-a", status: "approved" },
          { expense_date: "2026-06-15", amount_pln: "0.10", payer_id: "parent-b", status: "approved" },
          { expense_date: "2026-06-16", amount_pln: "2.75", payer_id: "parent-b", status: "pending" },
          { expense_date: "2026-05-10", amount_pln: "99.99", payer_id: "parent-a", status: "declined" },
          { expense_date: "2026-07-01", amount_pln: "20.00", payer_id: "parent-a", status: "approved" },
        ],
        settlements: [
          { report_month: "2026-06-01", status: "open" },
          { report_month: "2026-04-01", status: "settled" },
        ],
      }),
    ).toEqual([
      { month: "2026-06", status: "unsettled", approvedAmount: "10.35" },
      { month: "2026-05", status: "unsettled", approvedAmount: "0.00" },
      { month: "2026-04", status: "settled", approvedAmount: "0.00" },
    ]);
  });

  it("returns no report history for empty or current-only source rows", () => {
    expect(
      deriveMonthlyReportHistory({
        currentMonth: "2026-07",
        expenses: [{ expense_date: "2026-07-01", amount_pln: "1.00", payer_id: "parent-a", status: "approved" }],
        settlements: [{ report_month: "2026-07-01", status: "settled" }],
      }),
    ).toEqual([]);
  });

  it("keeps a pending-only report with a zero approved total", () => {
    expect(
      mapMonthlyReportHistoryRows([{ report_month: "2026-06-01", status: "open", approved_amount: "0.00" }]),
    ).toEqual([{ month: "2026-06", status: "unsettled", approvedAmount: "0.00" }]);
  });

  it("allows every valid month before the current report month", () => {
    expect(isAccessibleHistoricalReportMonth("2026-06", "2026-07")).toBe(true);
    expect(isAccessibleHistoricalReportMonth("June 2026", "2026-07")).toBe(false);
    expect(isAccessibleHistoricalReportMonth("2026-07", "2026-07")).toBe(false);
    expect(isAccessibleHistoricalReportMonth("2026-08", "2026-07")).toBe(false);
    expect(isAccessibleHistoricalReportMonth("2026-05", "2026-07")).toBe(true);
  });

  it("explains why a selected month cannot be settled", () => {
    expect(
      getSettlementUnavailableReason({
        expenses: [],
        parentIds: ["parent-a", "parent-b"],
        month: "2026-07",
        currentMonth: "2026-07",
      }),
    ).toBe("current-month");
    expect(
      getSettlementUnavailableReason({
        expenses: [],
        parentIds: ["parent-a"],
        month: "2026-06",
        currentMonth: "2026-07",
      }),
    ).toBe("one-parent");
    expect(
      getSettlementUnavailableReason({
        expenses: [],
        parentIds: ["parent-a", "parent-b"],
        month: "2026-06",
        currentMonth: "2026-07",
      }),
    ).toBe("no-expenses");
    expect(
      getSettlementUnavailableReason({
        expenses: [{ status: "pending" }],
        parentIds: ["parent-a", "parent-b"],
        month: "2026-06",
        currentMonth: "2026-07",
      }),
    ).toBe("pending");
    expect(
      getSettlementUnavailableReason({
        expenses: [{ status: "declined" }],
        parentIds: ["parent-a", "parent-b"],
        month: "2026-06",
        currentMonth: "2026-07",
      }),
    ).toBe("declined");
  });

  it("maps settlement failures to safe, settlement-specific feedback", () => {
    expect(mapSettlementError({ message: "You have already confirmed this settlement" })).toBe(
      "You have already confirmed this settlement.",
    );
    expect(mapSettlementError({ message: "A month with no expenses cannot be settled" })).toBe(
      "Add at least one expense before confirming settlement.",
    );
    expect(mapSettlementError({ message: "Settlement month must be the first day of a month" })).toBe(
      "Choose a valid report month.",
    );
    expect(mapSettlementError({ message: "internal database detail" })).toBe(
      "We could not confirm this settlement. Please try again.",
    );
  });

  it("distinguishes which parent must provide the second confirmation", () => {
    const common = {
      row: {
        status: "open" as const,
        first_confirmed_by: "parent-a",
        second_confirmed_by: null,
        approved_amount_pln: null,
        first_confirmed_contribution_pln: null,
        second_confirmed_contribution_pln: null,
        payment_from_membership_id: null,
        payment_amount_pln: null,
      },
      expenses: [],
      parentIds: ["parent-a", "parent-b"],
      balance: null,
      month: "2026-06",
      today: new Date("2026-07-15T12:00:00Z"),
    };
    expect(deriveSettlementState({ ...common, currentMembershipId: "parent-a" })).toEqual({
      kind: "awaiting-other-parent",
      isLocked: true,
    });
    expect(deriveSettlementState({ ...common, currentMembershipId: "parent-b" })).toEqual({
      kind: "requires-your-confirmation",
      isLocked: true,
    });
  });

  it("maps exact payment and balanced snapshots without number coercion", () => {
    const common = {
      expenses: [],
      parentIds: ["parent-a", "parent-b"],
      currentMembershipId: "parent-a",
      balance: null,
      month: "2026-06",
      today: new Date("2026-07-15T12:00:00Z"),
    };
    expect(
      deriveSettlementState({
        ...common,
        row: {
          status: "settled",
          first_confirmed_by: "parent-a",
          second_confirmed_by: "parent-b",
          approved_amount_pln: "20.10",
          first_confirmed_contribution_pln: "20.10",
          second_confirmed_contribution_pln: "0.00",
          payment_from_membership_id: "parent-b",
          payment_amount_pln: "10",
        },
      }),
    ).toEqual({
      kind: "settled",
      isLocked: true,
      approvedAmount: "20.10",
      firstConfirmedContribution: "20.10",
      secondConfirmedContribution: "0.00",
      paymentAmount: "10",
      paymentFromCurrentParent: false,
    });
    expect(
      deriveSettlementState({
        ...common,
        row: {
          status: "settled",
          first_confirmed_by: "parent-a",
          second_confirmed_by: "parent-b",
          approved_amount_pln: "20.00",
          first_confirmed_contribution_pln: "10.00",
          second_confirmed_contribution_pln: "10.00",
          payment_from_membership_id: null,
          payment_amount_pln: "0",
        },
      }),
    ).toMatchObject({ kind: "settled", paymentAmount: "0", paymentFromCurrentParent: null });
  });

  it("derives eligible and current-month states at an explicit date boundary", () => {
    const expenses = [
      {
        id: "expense-a",
        description: "School",
        expenseDate: "2026-06-10",
        amountPln: "20.00",
        status: "approved" as const,
        payerId: "parent-a",
        childId: null,
        childName: null,
        declineReason: null,
        previousDeclineReason: null,
      },
    ];
    const balance = {
      totalAmount: new Decimal("20.00"),
      approvedAmount: new Decimal("20.00"),
      toReviewAmount: new Decimal(0),
      contributions: new Map([
        ["parent-a", new Decimal("20.00")],
        ["parent-b", new Decimal(0)],
      ]),
      settlement: {
        kind: "payment" as const,
        amount: new Decimal(10),
        fromParentId: "parent-b",
        toParentId: "parent-a",
      },
    };
    const common = {
      row: null,
      expenses,
      parentIds: ["parent-a", "parent-b"],
      currentMembershipId: "parent-a",
      balance,
      today: new Date("2026-07-01T00:00:00Z"),
    };
    expect(deriveSettlementState({ ...common, month: "2026-06" })).toEqual({
      kind: "eligible",
      isLocked: false,
    });
    expect(deriveSettlementState({ ...common, month: "2026-07" })).toEqual({
      kind: "unavailable",
      isLocked: false,
      reason: "current-month",
    });
  });
});
