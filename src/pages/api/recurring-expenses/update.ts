import type { APIRoute } from "astro";
import { mapRecurringExpenseError, updateRecurringExpense } from "@/lib/recurring-expenses";
import { formValue } from "@/lib/family-onboarding";

export const POST: APIRoute = async (context) => {
  if (!context.locals.supabase || !context.locals.user)
    return Response.json({ error: "Please sign in and try again." }, { status: 401 });
  try {
    const form = await context.request.formData();
    const recurringExpenseId = await updateRecurringExpense(context.locals.supabase, {
      recurringExpenseId: formValue(form.get("recurringExpenseId")),
      childId: formValue(form.get("childId")) || null,
      description: formValue(form.get("description")),
      amount: formValue(form.get("amount")),
      startDate: formValue(form.get("startDate")),
      endDate: formValue(form.get("endDate")) || null,
    });
    return Response.json({ recurringExpenseId });
  } catch (error) {
    return Response.json({ error: mapRecurringExpenseError(error) }, { status: 400 });
  }
};
