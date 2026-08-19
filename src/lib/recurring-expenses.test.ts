import { describe, expect, it } from "vitest";
import { mapRecurringExpenseError, normalizeRecurringExpenseInput } from "./recurring-expenses";

describe("recurring expense inputs", () => {
  it("normalizes a monthly schedule and optional cancellation date", () => {
    expect(
      normalizeRecurringExpenseInput({
        childId: null,
        description: "  Music lessons ",
        amount: "45,5",
        startDate: "2026-08",
        endDate: "",
      }),
    ).toEqual({
      childId: null,
      description: "Music lessons",
      amount: "45.50",
      startDate: "2026-08-01",
      endDate: null,
    });
  });

  it("rejects invalid months and inverted ranges", () => {
    expect(() =>
      normalizeRecurringExpenseInput({
        childId: null,
        description: "Music",
        amount: "45",
        startDate: "2026-13",
        endDate: null,
      }),
    ).toThrow("start month");
    expect(() =>
      normalizeRecurringExpenseInput({
        childId: null,
        description: "Music",
        amount: "45",
        startDate: "2026-08",
        endDate: "2026-07",
      }),
    ).toThrow("End date");
  });

  it("maps ownership failures without exposing raw RPC messages", () => {
    expect(mapRecurringExpenseError(new Error("Only the payer can manage this recurring expense"))).toBe(
      "Only the paying parent can manage this recurring expense.",
    );
  });

  it("keeps a revision's start month valid when it is scheduled for the next month", () => {
    expect(
      normalizeRecurringExpenseInput({
        childId: null,
        description: "Music",
        amount: "45",
        startDate: "2026-09",
        endDate: null,
      }).startDate,
    ).toBe("2026-09-01");
  });
});
