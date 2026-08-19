import type { APIRoute } from "astro";
import { formValue, mapOnboardingError, normalizeDisplayName } from "@/lib/family-onboarding";

export const POST: APIRoute = async (context) => {
  const form = await context.request.formData();
  const email = form.get("email") as string;
  const password = form.get("password") as string;
  let displayName: string;
  try {
    displayName = normalizeDisplayName(formValue(form.get("displayName")));
  } catch (error) {
    return context.redirect(`/auth/signup?error=${encodeURIComponent(mapOnboardingError(error))}`);
  }

  const { supabase } = context.locals;
  if (!supabase) {
    return context.redirect(`/auth/signup?error=${encodeURIComponent("Supabase is not configured")}`);
  }
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName } },
  });

  if (error) {
    return context.redirect(`/auth/signup?error=${encodeURIComponent(error.message)}`);
  }

  return context.redirect(data.session ? "/dashboard" : "/auth/confirm-email");
};
