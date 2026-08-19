import { describe, expect, it, vi } from "vitest";
import { refreshExpenseWorkspace, refreshExpenseWorkspaceOrNavigate } from "./expense-workspace-refresh";

describe("expense workspace refresh", () => {
  const location = {
    assign: vi.fn(),
    hash: "",
    href: "http://localhost:4321/dashboard",
    pathname: "/dashboard",
    search: "",
  };

  it("delegates refreshes to the workspace callback", async () => {
    const refresh = vi.fn(() => Promise.resolve());

    await refreshExpenseWorkspace({ refreshExpenseWorkspace: refresh, location }, "2026-08");

    expect(refresh).toHaveBeenCalledWith("2026-08");
  });

  it("rejects safely when the workspace callback is unavailable", async () => {
    await expect(refreshExpenseWorkspace({ location }, "2026-08")).rejects.toThrow("Unable to refresh expenses");
  });

  it("falls back to the same workspace month after a successful action cannot refresh", async () => {
    const assign = vi.fn();

    await refreshExpenseWorkspaceOrNavigate(
      {
        refreshExpenseWorkspace: () => Promise.reject(new Error("Unable to refresh expenses")),
        location: {
          assign,
          hash: "",
          href: "http://localhost:4321/dashboard?success=expense-approved",
          pathname: "/dashboard",
          search: "?success=expense-approved",
        },
      },
      "2026-08",
    );

    expect(assign).toHaveBeenCalledWith("/dashboard?success=expense-approved&month=2026-08");
  });
});
