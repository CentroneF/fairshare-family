import { describe, expect, it } from "vitest";
import { loadMonthlyBalance } from "./financial-service";
import {
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
});
