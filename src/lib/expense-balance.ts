import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseFinancialRepository, loadMonthlyBalance } from "./financial-service";
import { parsePlnAmount, type MonthlyBalance } from "./financial-rules";

type ExpenseClient = SupabaseClient;

export class ExpenseBalanceError extends Error {}

export interface ExpenseDisplay {
  id: string;
  description: string;
  expenseDate: string;
  amountPln: string;
  status: "pending" | "approved" | "declined";
  payerId: string;
  childName: string | null;
}

export interface ExpenseWorkspaceState {
  expenses: readonly ExpenseDisplay[];
  currentMembershipId: string | null;
  balance: MonthlyBalance | null;
}

export function normalizeExpenseAmount(value: string): string {
  const amount = value.trim().replace(",", ".");
  return parsePlnAmount(amount).toFixed(2);
}

export function normalizeExpenseDate(value: string, today = new Date()): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ExpenseBalanceError("Enter an expense date.");
  }
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new ExpenseBalanceError("Enter a valid expense date.");
  }
  const currentDate = today.toISOString().slice(0, 10);
  if (value > currentDate) {
    throw new ExpenseBalanceError("Expense date cannot be in the future.");
  }
  return value;
}

export function normalizeSelectedMonth(value: string | null, today = new Date()): string {
  const currentMonth = today.toISOString().slice(0, 7);
  if (!value) return currentMonth;
  const [year, month] = value.split("-").map(Number);
  if (
    !/^\d{4}-\d{2}$/.test(value) ||
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12 ||
    value > currentMonth
  ) {
    throw new ExpenseBalanceError("Choose the current month or an earlier month.");
  }
  return value;
}

export function mapExpenseError(error: unknown): string {
  if (error instanceof ExpenseBalanceError) return error.message;
  const message =
    error instanceof Error
      ? error.message
      : error && typeof error === "object" && typeof (error as { message?: unknown }).message === "string"
        ? (error as { message: string }).message
        : "";
  if (message.includes("Expense description is required")) return "Enter an expense description.";
  if (message.includes("Amount must be")) return "Enter a positive amount with at most two decimal places.";
  if (message.includes("Expense date cannot")) return "Expense date cannot be in the future.";
  if (message.includes("Selected child")) return "Choose a child from your family or leave it empty.";
  if (message.includes("Only the other parent")) return "Only the other parent can approve this expense.";
  if (message.includes("Exactly two active parents"))
    return "Both active parents must be in the family before an expense can be approved.";
  if (message.includes("already been reviewed")) return "This expense has already been reviewed.";
  if (message.includes("not available to this family")) return "This expense is no longer available.";
  if (message.includes("Authentication is required")) return "Please sign in and try again.";
  return "We could not save that expense. Please try again.";
}

export function normalizeExpenseId(value: string): string {
  const id = value.trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    throw new ExpenseBalanceError("This expense is no longer available.");
  }
  return id;
}

function parseExpenseDisplayAmount(value: unknown): string | null {
  if (typeof value === "string") {
    try {
      return parsePlnAmount(value).toFixed(2);
    } catch {
      return null;
    }
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    try {
      return parsePlnAmount(value.toString()).toFixed(2);
    } catch {
      return null;
    }
  }

  return null;
}

export async function createExpense(
  client: ExpenseClient,
  input: { childId: string | null; description: string; expenseDate: string; amount: string },
): Promise<void> {
  const description = input.description.trim();
  if (!description) throw new ExpenseBalanceError("Enter an expense description.");
  const amount = normalizeExpenseAmount(input.amount);
  const expenseDate = normalizeExpenseDate(input.expenseDate);
  const { error } = await client.rpc("create_expense", {
    p_child_id: input.childId,
    p_description: description,
    p_expense_date: expenseDate,
    p_amount_pln: amount,
  });
  if (error) throw new ExpenseBalanceError(mapExpenseError(error));
}

export async function approveExpense(client: ExpenseClient, rawExpenseId: string): Promise<void> {
  const expenseId = normalizeExpenseId(rawExpenseId);
  const { error } = await client.rpc("approve_expense", { p_expense_id: expenseId });
  if (error) throw new ExpenseBalanceError(mapExpenseError(error));
}

async function loadCurrentMembershipId(
  client: ExpenseClient,
  familyId: string,
  userId: string,
): Promise<string | null> {
  const result = await client
    .from("family_members")
    .select("id")
    .eq("family_id", familyId)
    .eq("user_id", userId)
    .eq("role", "parent")
    .eq("is_active", true)
    .maybeSingle();
  if (result.error) throw new ExpenseBalanceError("We could not load the family balance.");
  const value = result.data as unknown;
  return value && typeof value === "object" && typeof (value as { id?: unknown }).id === "string"
    ? (value as { id: string }).id
    : null;
}

export async function loadExpenseWorkspaceState(
  client: ExpenseClient,
  input: { familyId: string; userId: string; month: string },
): Promise<ExpenseWorkspaceState> {
  const repository = createSupabaseFinancialRepository(client);
  const [expenses, parentIds, currentMembershipId] = await Promise.all([
    listMonthExpenses(client, input.familyId, input.month),
    repository.listActiveParentIds(input.familyId, input.userId),
    loadCurrentMembershipId(client, input.familyId, input.userId),
  ]);
  const balance =
    parentIds.length === 2
      ? await loadMonthlyBalance({
          repository,
          familyId: input.familyId,
          userId: input.userId,
          month: input.month,
        })
      : null;
  return { expenses, currentMembershipId, balance };
}

export async function listMonthExpenses(
  client: ExpenseClient,
  familyId: string,
  month: string,
): Promise<ExpenseDisplay[]> {
  const [year, monthNumber] = month.split("-").map(Number);
  const nextMonth = new Date(Date.UTC(year, monthNumber, 1)).toISOString().slice(0, 10);
  const start = `${month}-01`;
  const result = await client
    .from("expenses")
    .select("id, description, expense_date, amount_pln, status, payer_id, children(name)")
    .eq("family_id", familyId)
    .gte("expense_date", start)
    .lt("expense_date", nextMonth)
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (result.error) throw new ExpenseBalanceError(mapExpenseError(result.error));
  const rows = result.data as unknown;
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((row) => {
    if (typeof row !== "object" || row === null) return [];
    const value = row as Record<string, unknown>;
    const child: unknown = Array.isArray(value.children) ? value.children[0] : value.children;
    const amountPln = parseExpenseDisplayAmount(value.amount_pln);
    if (
      typeof value.id !== "string" ||
      typeof value.description !== "string" ||
      typeof value.expense_date !== "string" ||
      !amountPln ||
      typeof value.payer_id !== "string" ||
      (value.status !== "pending" && value.status !== "approved" && value.status !== "declined")
    ) {
      return [];
    }
    return [
      {
        id: value.id,
        description: value.description,
        expenseDate: value.expense_date,
        amountPln,
        status: value.status,
        payerId: value.payer_id,
        childName:
          child && typeof child === "object" && typeof (child as { name?: unknown }).name === "string"
            ? (child as { name: string }).name
            : null,
      },
    ];
  });
}
