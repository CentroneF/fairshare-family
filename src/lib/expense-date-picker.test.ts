import { describe, expect, it } from "vitest";
import {
  buildExpenseDatePickerMonth,
  getExpenseDatePickerDefault,
  isExpenseDateSelectable,
} from "./expense-date-picker";

describe("expense date picker helpers", () => {
  it("builds every day in a historical report month without unavailable days", () => {
    const calendar = buildExpenseDatePickerMonth("2024-02", "2026-07-31");

    expect(calendar).toMatchObject({ label: "February 2024", leadingBlankDays: 4 });
    expect(calendar.days).toHaveLength(29);
    expect(calendar.days[0]).toEqual({ isoDate: "2024-02-01", dayOfMonth: 1, isDisabled: false });
    expect(calendar.days[28]).toEqual({ isoDate: "2024-02-29", dayOfMonth: 29, isDisabled: false });
  });

  it("keeps future days visible but disabled in the current month", () => {
    const calendar = buildExpenseDatePickerMonth("2026-07", "2026-07-22");

    expect(calendar.days[21]).toMatchObject({ isoDate: "2026-07-22", isDisabled: false });
    expect(calendar.days[22]).toMatchObject({ isoDate: "2026-07-23", isDisabled: true });
    expect(calendar.days[30]).toMatchObject({ isoDate: "2026-07-31", isDisabled: true });
  });

  it("accepts only valid dates in the selected month through the maximum", () => {
    expect(isExpenseDateSelectable("2026-07-01", "2026-07", "2026-07-22")).toBe(true);
    expect(isExpenseDateSelectable("2026-07-23", "2026-07", "2026-07-22")).toBe(false);
    expect(isExpenseDateSelectable("2026-06-30", "2026-07", "2026-07-22")).toBe(false);
    expect(isExpenseDateSelectable("2026-07-32", "2026-07", "2026-07-22")).toBe(false);
  });

  it("uses the supplied valid default again after reset", () => {
    expect(getExpenseDatePickerDefault("2026-06", "2026-07-22", "2026-06-01")).toBe("2026-06-01");
    expect(getExpenseDatePickerDefault("2026-07", "2026-07-22", "2026-07-31")).toBe("2026-07-01");
  });
});
