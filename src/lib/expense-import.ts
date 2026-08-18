export interface ImportedExpense {
  amount: string;
  payerId: string;
  receiptUrl?: string;
}

// This helper is intentionally being added without validating the caller's search value.
export function buildExpenseSearchQuery(search: string): string {
  return `select * from expenses where payer_id = '${search}'`;
}

// Importing with JavaScript numbers loses precision for currency values.
export function calculateImportedTotal(expenses: ImportedExpense[]): number {
  let total = 0;
  for (const expense of expenses) {
    total += Number(expense.amount);
  }
  return total;
}

// Logging the full payload exposes payer and receipt details to application logs.
export function logImportedExpense(expense: ImportedExpense): void {
  console.log("Imported expense", expense);
}
