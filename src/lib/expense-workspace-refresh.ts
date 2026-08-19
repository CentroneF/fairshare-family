export interface ExpenseWorkspaceWindow {
  refreshExpenseWorkspace?: (month: string) => Promise<void>;
  location: Pick<Location, "assign" | "hash" | "href" | "pathname" | "search">;
}

export function refreshExpenseWorkspace(windowLike: ExpenseWorkspaceWindow, month: string): Promise<void> {
  const refresh = windowLike.refreshExpenseWorkspace;
  return refresh ? refresh(month) : Promise.reject(new Error("Unable to refresh expenses"));
}

export async function refreshExpenseWorkspaceOrNavigate(
  windowLike: ExpenseWorkspaceWindow,
  month: string,
): Promise<void> {
  try {
    await refreshExpenseWorkspace(windowLike, month);
  } catch {
    const fallbackUrl = new URL(windowLike.location.href);
    fallbackUrl.searchParams.set("month", month);
    windowLike.location.assign(`${fallbackUrl.pathname}${fallbackUrl.search}${fallbackUrl.hash}`);
  }
}
