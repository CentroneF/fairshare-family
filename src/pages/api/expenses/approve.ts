import type { APIRoute } from "astro";
import {
  approveExpense,
  loadExpenseWorkspaceState,
  mapExpenseError,
  normalizeSelectedMonth,
} from "@/lib/expense-balance";
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
      const membershipResult = await supabase
        .from("family_members")
        .select("family_id")
        .eq("user_id", context.locals.user.id)
        .eq("role", "parent")
        .eq("is_active", true)
        .maybeSingle();
      const membership = membershipResult.data as unknown;
      const familyId =
        membership &&
        typeof membership === "object" &&
        typeof (membership as { family_id?: unknown }).family_id === "string"
          ? (membership as { family_id: string }).family_id
          : null;
      if (membershipResult.error || !familyId) {
        throw new Error("We could not load the family balance.");
      }
      const state = await loadExpenseWorkspaceState(supabase, {
        familyId,
        userId: context.locals.user.id,
        month,
      });
      if (!state.balance) {
        throw new Error("We could not load the family balance.");
      }
      return Response.json({
        expenseId: formValue(form.get("expenseId")),
        month,
        balance: {
          totalAmount: state.balance.totalAmount.toFixed(2),
          approvedAmount: state.balance.approvedAmount.toFixed(2),
          toReviewAmount: state.balance.toReviewAmount.toFixed(2),
          settlement:
            state.balance.settlement.kind === "balanced"
              ? { kind: "balanced", amount: state.balance.settlement.amount.toFixed(0) }
              : {
                  kind: "payment",
                  amount: state.balance.settlement.amount.toFixed(0),
                  fromParentId: state.balance.settlement.fromParentId,
                  toParentId: state.balance.settlement.toParentId,
                },
        },
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
