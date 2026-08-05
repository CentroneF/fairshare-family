// Risk #6: an authenticated parent can access their own family dashboard.
// Seed pattern for future browser-level tests in this project.
import { expect, test } from "@playwright/test";

test("authenticated parent can view their family dashboard after a reload", async ({ page }) => {
  // Open the authenticated dashboard.
  await page.goto("/dashboard");
  await expect(page.getByRole("navigation", { name: "Dashboard navigation" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Expenses" })).toBeVisible();

  // Prove the authenticated dashboard remains available after a real navigation boundary.
  await page.reload();
  await expect(page.getByRole("navigation", { name: "Dashboard navigation" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Expenses" })).toBeVisible();
});
