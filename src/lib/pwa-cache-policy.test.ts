import { describe, expect, it } from "vitest";
import { isStaticPrecachePath, offlineDocument } from "./pwa-cache-policy.mjs";

describe("PWA cache policy", () => {
  it("allows only immutable static assets and the dedicated offline document in the precache", () => {
    expect(isStaticPrecachePath("/_astro/app.123.js")).toBe(true);
    expect(isStaticPrecachePath("pwa-icon-512.png")).toBe(true);
    expect(isStaticPrecachePath("dashboard/index.html")).toBe(false);
    expect(isStaticPrecachePath("_worker.js")).toBe(false);
    expect(isStaticPrecachePath("app.js.map")).toBe(false);
    expect(offlineDocument).toBe("offline/index.html");
  });
});
