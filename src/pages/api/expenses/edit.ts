import type { APIRoute } from "astro";
import {
  mapExpenseError,
  normalizeSelectedMonth,
  updateExpense,
  validateExpenseDateInMonth,
} from "@/lib/expense-balance";
import { formValue } from "@/lib/family-onboarding";

export const POST: APIRoute = async (context) => {
  const { supabase } = context.locals;
  const acceptsJson = context.request.headers.get("accept")?.includes("application/json");
  if (!supabase || !context.locals.user) {
    if (acceptsJson) return Response.json({ error: "Please sign in and try again." }, { status: 401 });
    return context.redirect(`/dashboard?error=${encodeURIComponent("Please sign in and try again.")}`);
  }

  const form = await context.request.formData();
  let month = "";
  try {
    month = normalizeSelectedMonth(formValue(form.get("month")) || null);
    const expenseDate = validateExpenseDateInMonth(formValue(form.get("expenseDate")), month);
    const expenseId = formValue(form.get("expenseId"));
    await updateExpense(supabase, {
      expenseId,
      childId: formValue(form.get("childId")) || null,
      description: formValue(form.get("description")),
      expenseDate,
      amount: formValue(form.get("amount")),
    });
    const destinationMonth = expenseDate.slice(0, 7);
    if (acceptsJson) return Response.json({ expenseId, month: destinationMonth });
    return context.redirect(`/dashboard?month=${destinationMonth}&success=expense-updated`);
  } catch (error) {
    const message = mapExpenseError(error);
    if (acceptsJson) return Response.json({ error: message }, { status: 400 });
    const query = new URLSearchParams({ error: message });
    if (month) query.set("month", month);
    return context.redirect(`/dashboard?${query.toString()}`);
  }
};
