import type { APIRoute } from "astro";
import { approveExpense, mapExpenseError, normalizeSelectedMonth } from "@/lib/expense-balance";
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
    await approveExpense(supabase, formValue(form.get("expenseId")));
    if (acceptsJson) {
      return Response.json({
        expenseId: formValue(form.get("expenseId")),
        month,
      });
    }
    return context.redirect(`/dashboard?month=${month}&success=expense-approved`);
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
