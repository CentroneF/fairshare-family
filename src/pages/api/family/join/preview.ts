import type { APIRoute } from "astro";
import { formValue, mapOnboardingError, previewFamilyJoin } from "@/lib/family-onboarding";

export const POST: APIRoute = async (context) => {
  const { supabase } = context.locals;
  if (!supabase || !context.locals.user) {
    return Response.json({ error: "Please sign in and try again." }, { status: 401 });
  }

  const form = await context.request.formData();
  try {
    const preview = await previewFamilyJoin(supabase, formValue(form.get("code")));
    return Response.json(preview);
  } catch (error) {
    return Response.json({ error: mapOnboardingError(error) }, { status: 400 });
  }
};
