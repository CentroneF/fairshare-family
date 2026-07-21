import { describe, expect, it } from "vitest";
import {
  deriveOnboardingState,
  mapOnboardingError,
  normalizeChildName,
  normalizeFamilyName,
  preserveJoinCode,
} from "./family-onboarding";

describe("family onboarding helpers", () => {
  it("trims required family and child names", () => {
    expect(normalizeFamilyName("  Kowalski  ")).toBe("Kowalski");
    expect(normalizeChildName("  Ada  ")).toBe("Ada");
    expect(() => normalizeFamilyName(" ")).toThrow("Enter a family name.");
    expect(() => normalizeChildName(" ")).toThrow("Enter a child name.");
  });

  it("preserves the exact case of valid join codes", () => {
    expect(preserveJoinCode("AbCd1234")).toBe("AbCd1234");
    expect(() => preserveJoinCode("abcd1234!")).toThrow("eight-character family code");
  });

  it("maps database errors to safe messages", () => {
    expect(mapOnboardingError(new Error("Family join code is invalid or unavailable"))).toBe(
      "That family code is invalid or no longer available.",
    );
    expect(mapOnboardingError(new Error("unexpected internal detail"))).toBe(
      "We could not complete that family action. Please try again.",
    );
  });

  it("derives each dashboard onboarding state", () => {
    expect(
      deriveOnboardingState({ membership: null, userId: "user-a", memberCount: 0, children: [], joinCode: null }),
    ).toEqual({ kind: "no-family" });

    expect(
      deriveOnboardingState({
        membership: { familyId: "family-a", familyName: "Kowalski", createdBy: "user-a" },
        userId: "user-a",
        memberCount: 1,
        children: [{ id: "child-a", name: "Ada" }],
        joinCode: "AbCd1234",
      }),
    ).toEqual({
      kind: "creator-awaiting-parent",
      family: { id: "family-a", name: "Kowalski", children: [{ id: "child-a", name: "Ada" }] },
      joinCode: "AbCd1234",
    });

    expect(
      deriveOnboardingState({
        membership: { familyId: "family-a", familyName: "Kowalski", createdBy: "user-a" },
        userId: "user-b",
        memberCount: 2,
        children: [],
        joinCode: null,
      }),
    ).toEqual({ kind: "two-parent-family", family: { id: "family-a", name: "Kowalski", children: [] } });

    expect(() =>
      deriveOnboardingState({
        membership: { familyId: "family-a", familyName: "Kowalski", createdBy: "user-a" },
        userId: "user-a",
        memberCount: 1,
        children: [],
        joinCode: null,
      }),
    ).toThrow("active family code");
  });
});
