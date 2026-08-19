import type { APIRoute } from "astro";
import { formValue, mapOnboardingError, updateFamilyMemberDisplayName } from "@/lib/family-onboarding";

export const POST: APIRoute = async (context) => {
  const { supabase, user } = context.locals;
  if (!supabase || !user) return Response.json({ error: "Please sign in and try again." }, { status: 401 });

  try {
    const form = await context.request.formData();
    await updateFamilyMemberDisplayName(supabase, formValue(form.get("displayName")));
    return Response.json({ displayName: formValue(form.get("displayName")).trim() });
  } catch (error) {
    return Response.json({ error: mapOnboardingError(error) }, { status: 400 });
  }
};
