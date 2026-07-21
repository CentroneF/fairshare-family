import type { APIRoute } from "astro";
import { mapOnboardingError, regenerateFamilyJoinCode } from "@/lib/family-onboarding";
import { createClient } from "@/lib/supabase";

export const POST: APIRoute = async (context) => {
  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase || !context.locals.user) {
    return context.redirect(`/dashboard?error=${encodeURIComponent("Please sign in and try again.")}`);
  }

  try {
    await regenerateFamilyJoinCode(supabase);
    return context.redirect("/dashboard?success=code-regenerated");
  } catch (error) {
    return context.redirect(`/dashboard?error=${encodeURIComponent(mapOnboardingError(error))}`);
  }
};
