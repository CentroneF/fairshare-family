import {
  canReviewExpense,
  deriveMonthlyBalance,
  isSettlementEligible,
  parsePlnAmount,
  type ExpenseStatus,
  type FinancialExpense,
  type MonthlyBalance,
} from "./financial-rules";

export interface FinancialExpenseRow {
  amount_pln: string;
  payer_id: string;
  status: ExpenseStatus;
}

export interface FinancialRepository {
  listActiveParentIds(familyId: string, userId: string): Promise<readonly string[]>;
  listMonthExpenses(familyId: string, userId: string, month: string): Promise<readonly FinancialExpenseRow[]>;
}

export function mapFinancialExpense(row: FinancialExpenseRow): FinancialExpense {
  return {
    amountPln: parsePlnAmount(row.amount_pln).toFixed(2),
    payerId: row.payer_id,
    status: row.status,
  };
}

export async function loadMonthlyBalance(input: {
  repository: FinancialRepository;
  familyId: string;
  userId: string;
  month: string;
}): Promise<MonthlyBalance> {
  const parentIds = await input.repository.listActiveParentIds(input.familyId, input.userId);
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
