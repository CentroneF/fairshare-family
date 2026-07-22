import type { APIRoute } from "astro";
import { createExpense, mapExpenseError, normalizeExpenseDate, normalizeSelectedMonth } from "@/lib/expense-balance";
import { formValue } from "@/lib/family-onboarding";
import { createClient } from "@/lib/supabase";

export const POST: APIRoute = async (context) => {
  const supabase = createClient(context.request.headers, context.cookies);
  const acceptsJson = context.request.headers.get("accept")?.includes("application/json");
  if (!supabase || !context.locals.user) {
    if (acceptsJson) {
      return Response.json({ error: "Please sign in and try again." }, { status: 401 });
    }
    return context.redirect(`/dashboard?error=${encodeURIComponent("Please sign in and try again.")}`);
  }

  const form = await context.request.formData();
  let month = "";
  try {
    month = normalizeSelectedMonth(formValue(form.get("month")) || null);
    const expenseDate = normalizeExpenseDate(formValue(form.get("expenseDate")));
    await createExpense(supabase, {
      childId: formValue(form.get("childId")) || null,
      description: formValue(form.get("description")),
      expenseDate,
      amount: formValue(form.get("amount")),
    });
    if (acceptsJson) {
      return Response.json({ month: expenseDate.slice(0, 7) }, { status: 201 });
    }
    return context.redirect(`/dashboard?month=${expenseDate.slice(0, 7)}&success=expense-created`);
  } catch (error) {
    const message = mapExpenseError(error);
    if (acceptsJson) {
      return Response.json({ error: message }, { status: 400 });
    }
    const query = new URLSearchParams({ error: message });
    if (month) query.set("month", month);
    return context.redirect(`/dashboard?${query.toString()}`);
  }
};
