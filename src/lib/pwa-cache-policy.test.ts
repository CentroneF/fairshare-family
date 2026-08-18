import { describe, expect, it } from "vitest";
import {
  isNetworkOnlyRequest,
  isStaticPrecachePath,
  offlineDocument,
  usesOfflineFallback,
} from "./pwa-cache-policy.mjs";

describe("PWA cache policy", () => {
  it("allows only immutable static assets and the dedicated offline document in the precache", () => {
    expect(isStaticPrecachePath("/_astro/app.123.js")).toBe(true);
    expect(isStaticPrecachePath("pwa-icon-512.png")).toBe(true);
    expect(isStaticPrecachePath("dashboard/index.html")).toBe(false);
    expect(isStaticPrecachePath("_worker.js")).toBe(false);
    expect(isStaticPrecachePath("app.js.map")).toBe(false);
    expect(offlineDocument).toBe("offline/index.html");
  });

  it("uses the neutral offline fallback only for document navigations", () => {
    expect(usesOfflineFallback({ method: "GET", mode: "navigate" })).toBe(true);
    expect(usesOfflineFallback({ method: "GET", mode: "cors" })).toBe(false);
    expect(usesOfflineFallback({ method: "POST", mode: "navigate" })).toBe(false);
  });

  it("keeps API, auth, Supabase, and mutation requests network-only", () => {
    expect(isNetworkOnlyRequest({ method: "GET", pathname: "/api/expenses/create" })).toBe(true);
    expect(isNetworkOnlyRequest({ method: "GET", pathname: "/auth/signin" })).toBe(true);
    expect(isNetworkOnlyRequest({ method: "GET", pathname: "/rest/v1/expenses", isSupabaseRequest: true })).toBe(true);
    expect(isNetworkOnlyRequest({ method: "PATCH", pathname: "/expenses/new" })).toBe(true);
    expect(isNetworkOnlyRequest({ method: "GET", pathname: "/dashboard" })).toBe(false);
  });
});
