import type { SupabaseClient } from "@supabase/supabase-js";
import Decimal from "decimal.js";
import {
  canReviewExpense,
  deriveMonthlyBalance,
  isSettlementEligible,
  parsePlnAmount,
  type ExpenseStatus,
  type FinancialExpense,
  type MonthlyBalance,
} from "./financial-rules";

type FinancialClient = SupabaseClient;

export interface FinancialExpenseRow {
  amount_pln: string;
  payer_id: string;
  status: ExpenseStatus;
}

export interface ActiveParent {
  id: string;
  displayName: string | null;
}

export interface FinancialRepository {
  listActiveParents(familyId: string, userId: string): Promise<readonly ActiveParent[]>;
  listMonthExpenses(familyId: string, userId: string, month: string): Promise<readonly FinancialExpenseRow[]>;
}

function monthRange(month: string): { start: string; nextMonth: string } {
  const [year, monthNumber] = month.split("-").map(Number);
  return {
    start: `${month}-01`,
    nextMonth: new Date(Date.UTC(year, monthNumber, 1)).toISOString().slice(0, 10),
  };
}

export function mapActiveParents(value: unknown): ActiveParent[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const parent = row as { id?: unknown; display_name?: unknown };
    if (typeof parent.id !== "string") return [];
    return [{ id: parent.id, displayName: typeof parent.display_name === "string" ? parent.display_name : null }];
  });
}

function parseFinancialExpenseRows(value: unknown): FinancialExpenseRow[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const expense = row as { amount_pln?: unknown; payer_id?: unknown; status?: unknown };
    const amount =
      typeof expense.amount_pln === "string"
        ? expense.amount_pln
        : typeof expense.amount_pln === "number" && Number.isFinite(expense.amount_pln)
          ? expense.amount_pln.toString()
          : null;
    if (
      !amount ||
      typeof expense.payer_id !== "string" ||
      (expense.status !== "pending" && expense.status !== "approved" && expense.status !== "declined")
    ) {
      return [];
    }
    return [{ amount_pln: amount, payer_id: expense.payer_id, status: expense.status }];
  });
}

export function createSupabaseFinancialRepository(client: FinancialClient): FinancialRepository {
  return {
    async listActiveParents(familyId: string, _userId: string): Promise<readonly ActiveParent[]> {
      const result = await client
        .from("family_members")
        .select("id, display_name")
        .eq("family_id", familyId)
        .eq("role", "parent")
        .eq("is_active", true)
        .order("created_at");
      if (result.error) throw new Error("We could not load the family balance.");
      return mapActiveParents(result.data);
    },
    async listMonthExpenses(familyId: string, _userId: string, month: string): Promise<readonly FinancialExpenseRow[]> {
      const { start, nextMonth } = monthRange(month);
      const result = await client
        .from("expenses")
        .select("amount_pln, payer_id, status")
        .eq("family_id", familyId)
        .gte("expense_date", start)
        .lt("expense_date", nextMonth);
      if (result.error) throw new Error("We could not load the family balance.");
      return parseFinancialExpenseRows(result.data);
    },
  };
}

export function mapFinancialExpense(row: FinancialExpenseRow): FinancialExpense {
  return {
    amountPln: parsePlnAmount(row.amount_pln).toFixed(2),
    payerId: row.payer_id,
    status: row.status,
  };
}

export function sumApprovedExpenseAmounts(expenses: readonly FinancialExpenseRow[]): Decimal {
  return expenses.reduce(
    (total, expense) => (expense.status === "approved" ? total.plus(parsePlnAmount(expense.amount_pln)) : total),
    new Decimal(0),
  );
}

export async function loadMonthlyBalance(input: {
  repository: FinancialRepository;
  familyId: string;
  userId: string;
  month: string;
  activeParents?: readonly ActiveParent[];
}): Promise<MonthlyBalance> {
  const activeParents = input.activeParents ?? (await input.repository.listActiveParents(input.familyId, input.userId));
  const parentIds = activeParents.map((parent) => parent.id);
  if (parentIds.length !== 2) {
    throw new Error("A monthly balance requires exactly two active parents");
  }
  const expenses = await input.repository.listMonthExpenses(input.familyId, input.userId, input.month);
  return deriveMonthlyBalance(expenses.map(mapFinancialExpense), [parentIds[0], parentIds[1]]);
}

export function validateExpenseCreation(input: {
  parentIds: readonly string[];
  payerId: string;
  amountPln: string;
}): void {
  if (!input.parentIds.includes(input.payerId)) {
    throw new Error("Expense payer must be an active parent");
  }
  parsePlnAmount(input.amountPln);
}

export function validateExpenseReview(input: {
  parentIds: readonly string[];
  payerId: string;
  reviewerId: string;
}): void {
  if (!canReviewExpense(input.parentIds, input.payerId, input.reviewerId)) {
    throw new Error("Only the other active parent can review an expense");
  }
}

export function validateSettlement(input: Parameters<typeof isSettlementEligible>[0]): void {
  if (!isSettlementEligible(input)) {
    throw new Error("This month is not eligible for settlement");
  }
}
