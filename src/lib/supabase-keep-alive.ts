export interface SupabaseKeepAliveConfig {
  supabaseUrl?: string;
  supabaseKey?: string;
  fetchImpl?: typeof fetch;
}

export async function keepSupabaseAlive({
  supabaseUrl,
  supabaseKey,
  fetchImpl = fetch,
}: SupabaseKeepAliveConfig): Promise<void> {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Supabase keep-alive configuration is missing");
  }

  const response = await fetchImpl(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/keep_alive`, {
    method: "POST",
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Supabase keep-alive RPC failed with status ${response.status}`);
  }
}
