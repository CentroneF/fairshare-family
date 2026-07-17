import { describe, expect, it } from "vitest";
import { canReviewExpense, deriveMonthlyBalance, isSettlementEligible, parsePlnAmount } from "./financial-rules";
import { mapFinancialExpense } from "./financial-service";

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
