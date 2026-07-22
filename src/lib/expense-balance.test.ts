import { describe, expect, it } from "vitest";
import { normalizeExpenseAmount, normalizeExpenseDate, normalizeSelectedMonth } from "./expense-balance";

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
});
