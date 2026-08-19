import type { SupabaseClient } from "@supabase/supabase-js";
import { ExpenseBalanceError, mapExpenseError, normalizeExpenseAmount, normalizeExpenseId } from "./expense-balance";

type RecurringExpenseClient = SupabaseClient;

export interface RecurringExpenseDisplay {
  id: string;
  payerId: string;
  childId: string | null;
  childName: string | null;
  description: string;
  amountPln: string;
  startDate: string;
  endDate: string | null;
  isActive: boolean;
  isArchived: boolean;
  pendingChangeEffectiveFrom: string | null;
}

function normalizeRecurringMonth(value: string, label: "start" | "end"): string {
  const month = value.trim();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))
    throw new ExpenseBalanceError(`Choose a recurring expense ${label} month.`);
  const date = `${month}-01`;
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new ExpenseBalanceError(`Choose a valid recurring expense ${label} month.`);
  }
  return date;
}

export function normalizeRecurringExpenseInput(input: {
  childId: string | null;
  description: string;
  amount: string;
  startDate: string;
  endDate: string | null;
}) {
  const description = input.description.trim();
  if (!description) throw new ExpenseBalanceError("Enter an expense description.");
  const startDate = normalizeRecurringMonth(input.startDate, "start");
  const endDate = input.endDate?.trim() ? normalizeRecurringMonth(input.endDate, "end") : null;
  if (endDate && endDate < startDate) throw new ExpenseBalanceError("End date must be on or after the start date.");
  return { childId: input.childId, description, amount: normalizeExpenseAmount(input.amount), startDate, endDate };
}

export function mapRecurringExpenseError(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("Only the payer")) return "Only the paying parent can manage this recurring expense.";
  if (message.includes("Stopped recurring")) return "Stopped recurring expenses cannot be resumed.";
  if (message.includes("Recurring expense end date")) return "End date must be on or after the start date.";
  if (message.includes("Recurring expense is not available")) return "This recurring expense is no longer available.";
  return mapExpenseError(error);
}

export async function createRecurringExpense(
  client: RecurringExpenseClient,
  input: Parameters<typeof normalizeRecurringExpenseInput>[0],
): Promise<string> {
  const normalized = normalizeRecurringExpenseInput(input);
  const { data, error } = (await client.rpc("create_recurring_expense", {
    p_child_id: normalized.childId,
    p_description: normalized.description,
    p_amount_pln: normalized.amount,
    p_start_date: normalized.startDate,
    p_end_date: normalized.endDate,
  })) as { data: unknown; error: unknown };
  if (error || typeof data !== "string") throw new ExpenseBalanceError(mapRecurringExpenseError(error));
  return data;
}

export async function updateRecurringExpense(
  client: RecurringExpenseClient,
  input: Parameters<typeof normalizeRecurringExpenseInput>[0] & { recurringExpenseId: string },
): Promise<string> {
  const normalized = normalizeRecurringExpenseInput(input);
  const recurringExpenseId = normalizeExpenseId(input.recurringExpenseId);
  const { data, error } = (await client.rpc("update_recurring_expense", {
    p_recurring_expense_id: recurringExpenseId,
    p_child_id: normalized.childId,
    p_description: normalized.description,
    p_amount_pln: normalized.amount,
    p_start_date: normalized.startDate,
    p_end_date: normalized.endDate,
  })) as { data: unknown; error: unknown };
  if (error || typeof data !== "string") throw new ExpenseBalanceError(mapRecurringExpenseError(error));
  return data;
}

export async function setRecurringExpenseActive(
  client: RecurringExpenseClient,
  rawRecurringExpenseId: string,
  isActive: boolean,
): Promise<string> {
  const { data, error } = (await client.rpc("set_recurring_expense_active", {
    p_recurring_expense_id: normalizeExpenseId(rawRecurringExpenseId),
    p_is_active: isActive,
  })) as { data: unknown; error: unknown };
  if (error || typeof data !== "string") throw new ExpenseBalanceError(mapRecurringExpenseError(error));
  return data;
}

export async function archiveRecurringExpense(
  client: RecurringExpenseClient,
  rawRecurringExpenseId: string,
): Promise<string> {
  const { data, error } = (await client.rpc("archive_recurring_expense", {
    p_recurring_expense_id: normalizeExpenseId(rawRecurringExpenseId),
  })) as { data: unknown; error: unknown };
  if (error || typeof data !== "string") throw new ExpenseBalanceError(mapRecurringExpenseError(error));
  return data;
}

export async function listRecurringExpenses(
  client: RecurringExpenseClient,
  familyId: string,
): Promise<RecurringExpenseDisplay[]> {
  const { data, error } = (await client
    .from("recurring_expenses")
    .select(
      "id, payer_id, child_id, description, amount_pln, start_date, end_date, is_active, archived_at, children(name), recurring_expense_revisions(effective_from)",
    )
    .eq("family_id", familyId)
    .order("created_at", { ascending: false })) as { data: unknown; error: unknown };
  if (error || !Array.isArray(data)) throw new ExpenseBalanceError("We could not load recurring expenses.");
  const currentMonth = new Date().toISOString().slice(0, 7) + "-01";
  return data.flatMap((row: unknown) => {
    const value = row as Record<string, unknown>;
    const { children: childrenValue }: { children?: unknown } = value;
    const child: unknown = Array.isArray(childrenValue) ? childrenValue[0] : childrenValue;
    const revisions = Array.isArray(value.recurring_expense_revisions)
      ? value.recurring_expense_revisions
          .flatMap((revision) => {
            const effectiveFrom =
              revision &&
              typeof revision === "object" &&
              typeof (revision as { effective_from?: unknown }).effective_from === "string"
                ? (revision as { effective_from: string }).effective_from
                : null;
            return effectiveFrom && effectiveFrom > currentMonth ? [effectiveFrom] : [];
          })
          .sort()
      : [];
    if (
      typeof value.id !== "string" ||
      typeof value.payer_id !== "string" ||
      typeof value.description !== "string" ||
      typeof value.start_date !== "string" ||
      typeof value.is_active !== "boolean"
    ) {
      return [];
    }
    const amount =
      typeof value.amount_pln === "number" || typeof value.amount_pln === "string" ? String(value.amount_pln) : "";
    try {
      return [
        {
          id: value.id,
          payerId: value.payer_id,
          childId: typeof value.child_id === "string" ? value.child_id : null,
          childName:
            child && typeof child === "object" && typeof (child as { name?: unknown }).name === "string"
              ? (child as { name: string }).name
              : null,
          description: value.description,
          amountPln: normalizeExpenseAmount(amount),
          startDate: value.start_date,
          endDate: typeof value.end_date === "string" ? value.end_date : null,
          isActive: value.is_active,
          isArchived: value.archived_at !== null,
          pendingChangeEffectiveFrom: revisions[0] ?? null,
        },
      ];
    } catch {
      return [];
    }
  });
}
