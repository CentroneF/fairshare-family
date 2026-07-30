import { describe, expect, it } from "vitest";
import { loadMonthlyBalance } from "./financial-service";
import {
  deriveMonthlyReportHistory,
  getSettlementUnavailableReason,
  mapMonthlyReportHistoryRows,
  mapExpenseError,
  normalizeExpenseAmount,
  normalizeDeclineReason,
  normalizeExpenseDate,
  normalizeExpenseId,
  normalizeSelectedMonth,
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
});
