import { describe, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import { refreshExpenseWorkspace } from "./expense-workspace-refresh";

describe("expense workspace refresh", () => {
  it("delegates refreshes to the workspace callback", async () => {
    const refresh = vi.fn(() => Promise.resolve());

    await refreshExpenseWorkspace({ refreshExpenseWorkspace: refresh }, "2026-08");

    expect(refresh).toHaveBeenCalledWith("2026-08");
  });

  it("rejects safely when the workspace callback is unavailable", async () => {
    const assign = vi.fn();
    const windowLike = { location: { assign } };

    await expect(refreshExpenseWorkspace(windowLike, "2026-08")).rejects.toThrow("Unable to refresh expenses");
    expect(assign).not.toHaveBeenCalled();
  });

  it("rejects when the workspace callback fails", async () => {
    const refresh = vi.fn(() => Promise.reject(new Error("Unable to refresh expenses")));
    const assign = vi.fn();
    const windowLike = { refreshExpenseWorkspace: refresh, location: { assign } };

    await expect(refreshExpenseWorkspace(windowLike, "2026-08")).rejects.toThrow("Unable to refresh expenses");
    expect(refresh).toHaveBeenCalledWith("2026-08");
    expect(assign).not.toHaveBeenCalled();
  });

  it("keeps the workspace runtime in Astro's processed client-script path", async () => {
    const workspaceSource = await readFile(
      new URL("../components/expenses/ExpenseWorkspace.astro", import.meta.url),
      "utf8",
    );

    expect(workspaceSource).toContain("data-expense-workspace data-refresh-target={refreshTarget}");
    expect(workspaceSource).not.toContain("<script define:vars");
  });
});
