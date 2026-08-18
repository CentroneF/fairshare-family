import { defineMiddleware } from "astro:middleware";
import { createClient } from "@/lib/supabase";

const PROTECTED_ROUTES = ["/dashboard", "/reports", "/expenses"];
const NETWORK_ONLY_ROUTES = [...PROTECTED_ROUTES, "/auth", "/api"];

function preventBrowserCaching(response: Response) {
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export const onRequest = defineMiddleware(async (context, next) => {
  const supabase = createClient(context.request.headers, context.cookies);
  context.locals.supabase = supabase;

  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    context.locals.user = user ?? null;
  } else {
    context.locals.user = null;
  }

  if (PROTECTED_ROUTES.some((route) => context.url.pathname.startsWith(route))) {
    if (!context.locals.user) {
      return preventBrowserCaching(context.redirect("/auth/signin"));
    }
  }

  const response = await next();

  if (NETWORK_ONLY_ROUTES.some((route) => context.url.pathname.startsWith(route))) {
    return preventBrowserCaching(response);
  }

  return response;
});
