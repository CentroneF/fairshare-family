export function setExpenseRefreshing(form: HTMLFormElement, isRefreshing: boolean) {
  const card = form.closest<HTMLElement>("[data-expense-id]");
  if (!card) return;

  card.toggleAttribute("aria-busy", isRefreshing);
  const status = card.querySelector<HTMLElement>("[data-expense-refresh-status]");
  status?.classList.toggle("hidden", !isRefreshing);
  status?.classList.toggle("flex", isRefreshing);
}
