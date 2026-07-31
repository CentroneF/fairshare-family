declare namespace App {
  interface Locals {
    supabase: import("@supabase/supabase-js").SupabaseClient | null;
    user: import("@supabase/supabase-js").User | null;
  }
}
