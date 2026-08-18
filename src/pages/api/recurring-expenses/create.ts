import type { APIRoute } from "astro";
import { createRecurringExpense, mapRecurringExpenseError } from "@/lib/recurring-expenses";
import { formValue } from "@/lib/family-onboarding";

export const POST: APIRoute = async (context) => {
  const acceptsJson = context.request.headers.get("accept")?.includes("application/json");
  if (!context.locals.supabase || !context.locals.user)
    return Response.json({ error: "Please sign in and try again." }, { status: 401 });
  try {
    const form = await context.request.formData();
    const recurringExpenseId = await createRecurringExpense(context.locals.supabase, {
      childId: formValue(form.get("childId")) || null,
      description: formValue(form.get("description")),
      amount: formValue(form.get("amount")),
      startDate: formValue(form.get("startDate")),
      endDate: formValue(form.get("endDate")) || null,
    });
    return acceptsJson
      ? Response.json({ recurringExpenseId }, { status: 201 })
      : context.redirect("/dashboard?success=recurring-expense-created");
  } catch (error) {
    const message = mapRecurringExpenseError(error);
    return acceptsJson
      ? Response.json({ error: message }, { status: 400 })
      : context.redirect(`/dashboard?error=${encodeURIComponent(message)}`);
  }
};
