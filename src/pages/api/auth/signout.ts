import type { APIRoute } from "astro";

export const POST: APIRoute = async (context) => {
  const { supabase } = context.locals;
  if (supabase) {
    await supabase.auth.signOut();
  }
  return context.redirect("/");
};
