export interface ExpenseDatePickerDay {
  isoDate: string;
  dayOfMonth: number;
  isDisabled: boolean;
}

export interface ExpenseDatePickerMonth {
  label: string;
  leadingBlankDays: number;
  days: ExpenseDatePickerDay[];
}

const ISO_MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function monthStart(month: string): Date {
  if (!ISO_MONTH_PATTERN.test(month)) throw new Error("Invalid expense month.");
  return new Date(`${month}-01T00:00:00Z`);
}

export function isExpenseDateSelectable(date: string, month: string, maxDate: string): boolean {
  return isValidIsoDate(date) && date.startsWith(`${month}-`) && date <= maxDate;
}

export function getExpenseDatePickerDefault(month: string, maxDate: string, defaultDate: string): string {
  return isExpenseDateSelectable(defaultDate, month, maxDate) ? defaultDate : `${month}-01`;
}

export function buildExpenseDatePickerMonth(month: string, maxDate: string): ExpenseDatePickerMonth {
  const start = monthStart(month);
  const year = start.getUTCFullYear();
  const monthIndex = start.getUTCMonth();
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();

  return {
    label: new Intl.DateTimeFormat("en", { month: "long", year: "numeric", timeZone: "UTC" }).format(start),
    leadingBlankDays: start.getUTCDay(),
    days: Array.from({ length: lastDay }, (_, index) => {
      const dayOfMonth = index + 1;
      const isoDate = `${month}-${String(dayOfMonth).padStart(2, "0")}`;
      return { isoDate, dayOfMonth, isDisabled: !isExpenseDateSelectable(isoDate, month, maxDate) };
    }),
  };
}
