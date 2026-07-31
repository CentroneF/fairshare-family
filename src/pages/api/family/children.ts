import type { APIRoute } from "astro";
import { addFamilyChild, formValue, mapOnboardingError, normalizeChildName } from "@/lib/family-onboarding";

export const POST: APIRoute = async (context) => {
  const { supabase } = context.locals;
  if (!supabase || !context.locals.user) {
    return context.redirect(`/dashboard?error=${encodeURIComponent("Please sign in and try again.")}`);
  }

  const form = await context.request.formData();
  try {
    const names = form.getAll("name").map(formValue).map(normalizeChildName);
    if (names.length === 0) {
      throw new Error("Child name is required");
    }
    await Promise.all(names.map((name) => addFamilyChild(supabase, name)));
    return context.redirect("/dashboard?success=child-added");
  } catch (error) {
    return context.redirect(`/dashboard?error=${encodeURIComponent(mapOnboardingError(error))}`);
  }
};
