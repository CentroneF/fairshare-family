import Decimal from "decimal.js";

export type ExpenseStatus = "pending" | "approved" | "declined";

export interface FinancialExpense {
  amountPln: string;
  payerId: string;
  status: ExpenseStatus;
}

export interface MonthlyBalance {
  totalAmount: Decimal;
  approvedAmount: Decimal;
  toReviewAmount: Decimal;
  contributions: ReadonlyMap<string, Decimal>;
  settlement:
    | { kind: "balanced"; amount: Decimal }
    | { kind: "payment"; amount: Decimal; fromParentId: string; toParentId: string };
}

const PLN_AMOUNT = /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/;

export function parsePlnAmount(value: string): Decimal {
  if (!PLN_AMOUNT.test(value)) {
    throw new Error("Amount must be a positive PLN value with at most two decimal places");
  }

  const amount = new Decimal(value);
  if (!amount.greaterThan(0)) {
    throw new Error("Amount must be positive");
  }

  return amount;
}

export function deriveMonthlyBalance(
  expenses: readonly FinancialExpense[],
  parentIds: readonly [string, string],
): MonthlyBalance {
  const [firstParentId, secondParentId] = parentIds;
  const contributions = new Map<string, Decimal>([
    [firstParentId, new Decimal(0)],
    [secondParentId, new Decimal(0)],
  ]);
  let approvedAmount = new Decimal(0);
  let toReviewAmount = new Decimal(0);

  for (const expense of expenses) {
    const amount = parsePlnAmount(expense.amountPln);
    if (expense.status === "approved") {
      const currentContribution = contributions.get(expense.payerId);
      if (!currentContribution) {
        throw new Error("Approved expense payer must be an active parent");
      }
      contributions.set(expense.payerId, currentContribution.plus(amount));
      approvedAmount = approvedAmount.plus(amount);
    } else if (expense.status === "pending") {
      toReviewAmount = toReviewAmount.plus(amount);
    }
  }

  const totalAmount = approvedAmount.plus(toReviewAmount);
  const firstParentContribution = contributions.get(firstParentId);
  if (!firstParentContribution) {
    throw new Error("Active parent contribution is missing");
  }
  const firstParentNet = firstParentContribution.minus(approvedAmount.div(2));
  const roundedSettlement = firstParentNet.abs().toDecimalPlaces(0, Decimal.ROUND_HALF_UP);

  if (roundedSettlement.isZero()) {
    return {
      totalAmount,
      approvedAmount,
      toReviewAmount,
      contributions,
      settlement: { kind: "balanced", amount: roundedSettlement },
    };
  }

  return {
    totalAmount,
    approvedAmount,
    toReviewAmount,
    contributions,
    settlement: firstParentNet.isPositive()
      ? { kind: "payment", amount: roundedSettlement, fromParentId: secondParentId, toParentId: firstParentId }
      : { kind: "payment", amount: roundedSettlement, fromParentId: firstParentId, toParentId: secondParentId },
  };
}

export function canReviewExpense(parentIds: readonly string[], payerId: string, reviewerId: string): boolean {
  return (
    new Set(parentIds).size === 2 &&
    parentIds.length === 2 &&
    parentIds.includes(payerId) &&
    parentIds.includes(reviewerId) &&
    payerId !== reviewerId
  );
}

export function isSettlementEligible(input: {
  expenses: readonly FinancialExpense[];
  parentIds: readonly string[];
  reportMonth: Date;
  today: Date;
}): boolean {
  const reportPeriod = new Date(input.reportMonth.getFullYear(), input.reportMonth.getMonth());
  const currentPeriod = new Date(input.today.getFullYear(), input.today.getMonth());
  return (
    new Set(input.parentIds).size === 2 &&
    input.parentIds.length === 2 &&
    reportPeriod < currentPeriod &&
    input.expenses.length > 0 &&
    input.expenses.every((expense) => expense.status === "approved")
  );
}
