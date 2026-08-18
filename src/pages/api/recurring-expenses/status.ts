import type { APIRoute } from "astro";
import { mapRecurringExpenseError, setRecurringExpenseActive } from "@/lib/recurring-expenses";
import { formValue } from "@/lib/family-onboarding";

export const POST: APIRoute = async (context) => {
  if (!context.locals.supabase || !context.locals.user)
    return Response.json({ error: "Please sign in and try again." }, { status: 401 });
  try {
    const form = await context.request.formData();
    const recurringExpenseId = await setRecurringExpenseActive(
      context.locals.supabase,
      formValue(form.get("recurringExpenseId")),
      formValue(form.get("isActive")) === "true",
    );
    return Response.json({ recurringExpenseId });
  } catch (error) {
    return Response.json({ error: mapRecurringExpenseError(error) }, { status: 400 });
  }
};
