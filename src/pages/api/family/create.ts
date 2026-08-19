import type { APIRoute } from "astro";
import { createFamily, formValue, mapOnboardingError } from "@/lib/family-onboarding";

export const POST: APIRoute = async (context) => {
  const { supabase } = context.locals;
  if (!supabase || !context.locals.user) {
    return context.redirect(`/dashboard?error=${encodeURIComponent("Please sign in and try again.")}`);
  }

  const form = await context.request.formData();
  try {
    await createFamily(
      supabase,
      formValue(form.get("name")),
      String(context.locals.user.user_metadata.display_name ?? ""),
    );
    return context.redirect("/dashboard?success=family-created");
  } catch (error) {
    return context.redirect(`/dashboard?error=${encodeURIComponent(mapOnboardingError(error))}`);
  }
};
