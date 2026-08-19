import { handle } from "@astrojs/cloudflare/handler";
import { SUPABASE_KEY, SUPABASE_URL } from "astro:env/server";
import { keepSupabaseAlive } from "./lib/supabase-keep-alive";

export default {
  fetch: handle,
  async scheduled(_controller: ScheduledController, _env: Env, _context: ExecutionContext): Promise<void> {
    try {
      await keepSupabaseAlive({ supabaseUrl: SUPABASE_URL, supabaseKey: SUPABASE_KEY });
      console.info("Supabase keep-alive completed");
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      console.error("Supabase keep-alive failed", message);
      throw error;
    }
  },
};
