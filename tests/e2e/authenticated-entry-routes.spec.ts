// Risk: an authenticated parent can reach public entry or auth screens instead of their dashboard.
// Seed: tests/e2e/seed.spec.ts
import { expect, test } from "@playwright/test";

test("authenticated parent is redirected from entry routes to their dashboard", async ({ page }) => {
  for (const route of ["/", "/auth/signin", "/auth/signup", "/auth/confirm-email"]) {
    await page.goto(route);
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("navigation", { name: "Dashboard navigation" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Expenses" })).toBeVisible();
  }
});
