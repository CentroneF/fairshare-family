import { describe, expect, it, vi } from "vitest";
import { keepSupabaseAlive } from "./supabase-keep-alive";

describe("keepSupabaseAlive", () => {
  it("posts once to the no-data RPC with the anon key headers", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 }));

    await keepSupabaseAlive({
      supabaseUrl: "https://example.supabase.co/",
      supabaseKey: "test-anon-key",
      fetchImpl,
    });

    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = fetchImpl.mock.calls[0] ?? [];
    expect(url).toBe("https://example.supabase.co/rest/v1/rpc/keep_alive");
    expect(init).toMatchObject({
      method: "POST",
      headers: {
        apikey: "test-anon-key",
        Authorization: "Bearer test-anon-key",
        "Content-Type": "application/json",
      },
    });
  });

  it("rejects missing configuration before making a request", async () => {
    const fetchImpl = vi.fn<typeof fetch>();

    await expect(keepSupabaseAlive({ supabaseUrl: "https://example.supabase.co", fetchImpl })).rejects.toThrow(
      "Supabase keep-alive configuration is missing",
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("reports a non-OK status without exposing credentials", async () => {
    const key = "test-anon-key";
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response("unexpected response", { status: 503 }));

    const failure = keepSupabaseAlive({
      supabaseUrl: "https://example.supabase.co",
      supabaseKey: key,
      fetchImpl,
    });

    await expect(failure).rejects.toThrow("Supabase keep-alive RPC failed with status 503");
    await failure.catch((error: unknown) => {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).not.toContain(key);
    });
  });
});
