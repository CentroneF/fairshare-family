import type { APIRoute } from "astro";
import { deleteExpense, mapExpenseError, normalizeSelectedMonth } from "@/lib/expense-balance";
import { formValue } from "@/lib/family-onboarding";
import { createClient } from "@/lib/supabase";

export const POST: APIRoute = async (context) => {
  const supabase = createClient(context.request.headers, context.cookies);
  const acceptsJson = context.request.headers.get("accept")?.includes("application/json");
  if (!supabase || !context.locals.user)
    return acceptsJson
      ? Response.json({ error: "Please sign in and try again." }, { status: 401 })
      : context.redirect(`/dashboard?error=${encodeURIComponent("Please sign in and try again.")}`);
  const form = await context.request.formData();
  let month = "";
  try {
    month = normalizeSelectedMonth(formValue(form.get("month")) || null);
    const expenseId = formValue(form.get("expenseId"));
    await deleteExpense(supabase, expenseId);
    if (acceptsJson) return Response.json({ expenseId, month });
    return context.redirect(`/dashboard?month=${month}&success=expense-deleted`);
  } catch (error) {
    const message = mapExpenseError(error);
    if (acceptsJson) return Response.json({ error: message }, { status: 400 });
    const query = new URLSearchParams({ error: message });
    if (month) query.set("month", month);
    return context.redirect(`/dashboard?${query.toString()}`);
  }
};
