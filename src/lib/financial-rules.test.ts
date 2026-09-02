import { describe, expect, it } from "vitest";
import { canReviewExpense, deriveMonthlyBalance, isSettlementEligible, parsePlnAmount } from "./financial-rules";
import { mapActiveParents, mapFinancialExpense } from "./financial-service";

const parents = ["parent-a", "parent-b"] as const;

describe("financial rules", () => {
  it("keeps exact decimal amounts and rounds only the final settlement half up", () => {
    const balance = deriveMonthlyBalance([{ amountPln: "1.00", payerId: "parent-a", status: "approved" }], parents);
    expect(balance.approvedAmount.toString()).toBe("1");
    expect(balance.settlement.kind).toBe("payment");
    if (balance.settlement.kind === "payment") {
      expect(balance.settlement.fromParentId).toBe("parent-b");
      expect(balance.settlement.toParentId).toBe("parent-a");
      expect(balance.settlement.amount.toString()).toBe("1");
    }
  });

  it("derives pending totals and excludes declined expenses", () => {
    const balance = deriveMonthlyBalance(
      [
        { amountPln: "10.00", payerId: "parent-a", status: "approved" },
        { amountPln: "2.50", payerId: "parent-b", status: "pending" },
        { amountPln: "99.99", payerId: "parent-a", status: "declined" },
      ],
      parents,
    );
    expect(balance.totalAmount.toString()).toBe("12.5");
    expect(balance.approvedAmount.toString()).toBe("10");
    expect(balance.toReviewAmount.toString()).toBe("2.5");
    expect(balance.contributions.get("parent-a")?.toFixed(2)).toBe("10.00");
    expect(balance.contributions.get("parent-b")?.toFixed(2)).toBe("0.00");
  });

  it.each([
    {
      name: "approved expense contributes to the balance and permits settlement",
      expense: { amountPln: "10.50", payerId: "parent-a", status: "approved" as const },
      expected: { totalAmount: "10.5", approvedAmount: "10.5", toReviewAmount: "0", eligible: true },
    },
    {
      name: "pending expense remains under review and blocks settlement",
      expense: { amountPln: "10.50", payerId: "parent-a", status: "pending" as const },
      expected: { totalAmount: "10.5", approvedAmount: "0", toReviewAmount: "10.5", eligible: false },
    },
    {
      name: "declined expense is excluded and blocks settlement",
      expense: { amountPln: "10.50", payerId: "parent-a", status: "declined" as const },
      expected: { totalAmount: "0", approvedAmount: "0", toReviewAmount: "0", eligible: false },
    },
  ])("$name", ({ expense, expected }) => {
    const reportMonth = new Date(2026, 5, 1);
    const today = new Date(2026, 6, 1);
    const balance = deriveMonthlyBalance([expense], parents);

    expect(balance.totalAmount.toString()).toBe(expected.totalAmount);
    expect(balance.approvedAmount.toString()).toBe(expected.approvedAmount);
    expect(balance.toReviewAmount.toString()).toBe(expected.toReviewAmount);
    expect(isSettlementEligible({ expenses: [expense], parentIds: parents, reportMonth, today })).toBe(
      expected.eligible,
    );
  });

  it("returns no settlement action for an equal or rounded-zero balance", () => {
    expect(deriveMonthlyBalance([], parents).settlement.kind).toBe("balanced");
    expect(
      deriveMonthlyBalance([{ amountPln: "0.01", payerId: "parent-a", status: "approved" }], parents).settlement.kind,
    ).toBe("balanced");
  });

  it("rejects invalid PLN input", () => {
    for (const amount of ["0", "-1.00", "1.001", "abc"]) {
      expect(() => parsePlnAmount(amount)).toThrow();
    }
    expect(parsePlnAmount("0.01").toString()).toBe("0.01");
  });

  it("maps database numeric strings without JavaScript number coercion", () => {
    expect(mapFinancialExpense({ amount_pln: "10.10", payer_id: "parent-a", status: "approved" }).amountPln).toBe(
      "10.10",
    );
  });

  it("maps ordered active parents with their display names", () => {
    expect(
      mapActiveParents([
        { id: "parent-a", display_name: "Ada Nowak" },
        { id: "parent-b", display_name: "Beata Nowak" },
        { id: 42, display_name: "Ignored" },
      ]),
    ).toEqual([
      { id: "parent-a", displayName: "Ada Nowak" },
      { id: "parent-b", displayName: "Beata Nowak" },
    ]);
  });

  it("requires the other active parent for review and a past fully-approved month for settlement", () => {
    expect(canReviewExpense(parents, "parent-a", "parent-b")).toBe(true);
    expect(canReviewExpense(parents, "parent-a", "parent-a")).toBe(false);
    expect(
      isSettlementEligible({
        expenses: [{ amountPln: "1.00", payerId: "parent-a", status: "approved" }],
        parentIds: parents,
        reportMonth: new Date(2026, 5, 1),
        today: new Date(2026, 6, 1),
      }),
    ).toBe(true);
    expect(
      isSettlementEligible({
        expenses: [{ amountPln: "1.00", payerId: "parent-a", status: "declined" }],
        parentIds: parents,
        reportMonth: new Date(2026, 5, 1),
        today: new Date(2026, 6, 1),
      }),
    ).toBe(false);
  });
});
