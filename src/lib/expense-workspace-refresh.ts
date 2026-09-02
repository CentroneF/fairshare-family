export interface ExpenseWorkspaceWindow {
  refreshExpenseWorkspace?: (month: string) => Promise<void>;
}

export function refreshExpenseWorkspace(windowLike: ExpenseWorkspaceWindow, month: string): Promise<void> {
  const refresh = windowLike.refreshExpenseWorkspace;
  return refresh ? refresh(month) : Promise.reject(new Error("Unable to refresh expenses"));
}
