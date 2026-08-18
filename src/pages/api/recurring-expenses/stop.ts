import type { APIRoute } from "astro";
import { archiveRecurringExpense, mapRecurringExpenseError } from "@/lib/recurring-expenses";
import { formValue } from "@/lib/family-onboarding";

export const POST: APIRoute = async (context) => {
  if (!context.locals.supabase || !context.locals.user)
    return Response.json({ error: "Please sign in and try again." }, { status: 401 });
  try {
    return Response.json({
      recurringExpenseId: await archiveRecurringExpense(
        context.locals.supabase,
        formValue((await context.request.formData()).get("recurringExpenseId")),
      ),
    });
  } catch (error) {
    return Response.json({ error: mapRecurringExpenseError(error) }, { status: 400 });
  }
};
