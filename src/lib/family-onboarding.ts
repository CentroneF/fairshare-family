import type { SupabaseClient } from "@supabase/supabase-js";

type FamilyClient = SupabaseClient;
interface QueryResult {
  data: unknown;
  error: unknown;
}

interface Membership {
  familyId: string;
  familyName: string;
  createdBy: string;
  displayName: string | null;
}

export interface FamilySummary {
  id: string;
  name: string;
  children: readonly { id: string; name: string }[];
}

export type OnboardingState =
  | { kind: "no-family" }
  | { kind: "creator-awaiting-parent"; family: FamilySummary; joinCode: string; displayName: string | null }
  | { kind: "two-parent-family"; family: FamilySummary; displayName: string | null };

export class OnboardingError extends Error {}

const JOIN_CODE = /^[A-Za-z0-9]{8}$/;

export function normalizeFamilyName(value: string): string {
  const name = value.trim();
  if (!name) {
    throw new OnboardingError("Enter a family name.");
  }
  return name;
}

export function normalizeChildName(value: string): string {
  const name = value.trim();
  if (!name) {
    throw new OnboardingError("Enter a child name.");
  }
  return name;
}

export function normalizeDisplayName(value: string): string {
  const name = value.trim();
  if (name.length < 5 || name.length > 15) {
    throw new OnboardingError("Enter a display name between 5 and 15 characters.");
  }
  return name;
}

export function preserveJoinCode(value: string): string {
  const code = value.trim();
  if (!JOIN_CODE.test(code)) {
    throw new OnboardingError("Enter the eight-character family code exactly as shared.");
  }
  return code;
}

export function formValue(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value : "";
}

export function mapOnboardingError(error: unknown): string {
  if (error instanceof OnboardingError) return error.message;

  const message = error instanceof Error ? error.message : "";

  if (message.includes("Family name is required")) return "Enter a family name.";
  if (message.includes("Child name is required")) return "Enter a child name.";
  if (message.includes("Display name must be between 5 and 15 characters")) {
    return "Enter a display name between 5 and 15 characters.";
  }
  if (message.includes("active family membership is required to update a display name")) {
    return "Join an active family before updating your display name.";
  }
  if (message.includes("already belongs to a family")) return "This account already belongs to a family.";
  if (message.includes("Family join code is invalid or unavailable")) {
    return "That family code is invalid or no longer available.";
  }
  if (message.includes("No active family join code is available")) {
    return "There is no active family code available.";
  }
  if (message.includes("Authentication is required")) return "Please sign in and try again.";

  return "We could not complete that family action. Please try again.";
}

function assertData<T>(data: T | undefined, error: unknown): T {
  if (error || data === undefined) {
    throw new OnboardingError(mapOnboardingError(error));
  }
  return data;
}

function parseMembership(value: unknown): Membership | null {
  if (!value || typeof value !== "object") return null;

  const row = value as { family_id?: unknown; families?: unknown; display_name?: unknown };
  const family = Array.isArray(row.families) ? (row.families as unknown[])[0] : row.families;
  if (!family || typeof family !== "object" || typeof row.family_id !== "string") return null;

  const details = family as { name?: unknown; created_by?: unknown };
  if (typeof details.name !== "string" || typeof details.created_by !== "string") return null;

  return {
    familyId: row.family_id,
    familyName: details.name,
    createdBy: details.created_by,
    displayName: typeof row.display_name === "string" ? row.display_name : null,
  };
}

function parseChildren(value: unknown): { id: string; name: string }[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const child = row as { id?: unknown; name?: unknown };
    return typeof child.id === "string" && typeof child.name === "string" ? [{ id: child.id, name: child.name }] : [];
  });
}

function parseRows(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : [];
}

function parseJoinCode(value: unknown): string | null {
  if (typeof value === "string") return value;
  const row = parseRows(value)[0];
  if (!row || typeof row !== "object") return null;

  const result = row as { get_family_join_code?: unknown };
  return typeof result.get_family_join_code === "string" ? result.get_family_join_code : null;
}

export function deriveOnboardingState(input: {
  membership: { familyId: string; familyName: string; createdBy: string; displayName: string | null } | null;
  userId: string;
  memberCount: number;
  children: readonly { id: string; name: string }[];
  joinCode: string | null;
}): OnboardingState {
  if (!input.membership) return { kind: "no-family" };

  const family = {
    id: input.membership.familyId,
    name: input.membership.familyName,
    children: input.children,
  };

  if (input.memberCount === 1 && input.membership.createdBy === input.userId) {
    if (!input.joinCode) throw new OnboardingError("We could not load the active family code.");
    return {
      kind: "creator-awaiting-parent",
      family,
      joinCode: input.joinCode,
      displayName: input.membership.displayName,
    };
  }

  if (input.memberCount === 2) return { kind: "two-parent-family", family, displayName: input.membership.displayName };

  throw new OnboardingError("We could not load this family.");
}

export async function resolveOnboardingState(client: FamilyClient, userId: string): Promise<OnboardingState> {
  const membershipResult = (await client
    .from("family_members")
    .select("family_id, display_name, families(id, name, created_by)")
    .eq("user_id", userId)
    .maybeSingle()) as unknown as QueryResult;
  const membership = parseMembership(membershipResult.data);

  if (membershipResult.error) throw new OnboardingError(mapOnboardingError(membershipResult.error));
  if (!membership) return { kind: "no-family" };

  const [membersResult, childrenResult] = (await Promise.all([
    client.from("family_members").select("id").eq("family_id", membership.familyId),
    client.from("children").select("id, name").eq("family_id", membership.familyId).order("created_at"),
  ])) as unknown as [QueryResult, QueryResult];
  if (membersResult.error) throw new OnboardingError(mapOnboardingError(membersResult.error));
  if (childrenResult.error) throw new OnboardingError(mapOnboardingError(childrenResult.error));

  const familyMembers = parseRows(membersResult.data);
  const children = parseChildren(childrenResult.data);

  if (familyMembers.length === 1 && membership.createdBy === userId) {
    const codeResult = (await client.rpc("get_family_join_code")) as unknown as QueryResult;
    const joinCode = parseJoinCode(codeResult.data);
    if (codeResult.error || !joinCode) {
      throw new OnboardingError("We could not load the active family code.");
    }

    return deriveOnboardingState({
      membership,
      userId,
      memberCount: familyMembers.length,
      children,
      joinCode,
    });
  }

  return deriveOnboardingState({
    membership,
    userId,
    memberCount: familyMembers.length,
    children,
    joinCode: null,
  });
}

export async function createFamily(client: FamilyClient, rawName: string, rawDisplayName: string): Promise<void> {
  const name = normalizeFamilyName(rawName);
  const displayName = normalizeDisplayName(rawDisplayName);
  const { error } = await client.rpc("create_family", { p_name: name, p_display_name: displayName });
  if (error) throw new OnboardingError(mapOnboardingError(error));
}

export async function addFamilyChild(client: FamilyClient, rawName: string): Promise<void> {
  const name = normalizeChildName(rawName);
  const { error } = await client.rpc("add_family_child", { p_name: name });
  if (error) throw new OnboardingError(mapOnboardingError(error));
}

export async function previewFamilyJoin(client: FamilyClient, rawCode: string): Promise<{ familyName: string }> {
  const code = preserveJoinCode(rawCode);
  const result = (await client.rpc("preview_family_join", { p_join_code: code })) as unknown as QueryResult;
  const rows = parseRows(result.data);
  const preview = assertData(rows[0], result.error);
  if (!preview || typeof preview !== "object") throw new OnboardingError(mapOnboardingError(result.error));
  const familyName = (preview as { family_name?: unknown }).family_name;
  if (typeof familyName !== "string") throw new OnboardingError(mapOnboardingError(result.error));
  return { familyName };
}

export async function confirmFamilyJoin(client: FamilyClient, rawCode: string, rawDisplayName: string): Promise<void> {
  const code = preserveJoinCode(rawCode);
  const displayName = normalizeDisplayName(rawDisplayName);
  const { error } = await client.rpc("confirm_family_join", { p_join_code: code, p_display_name: displayName });
  if (error) throw new OnboardingError(mapOnboardingError(error));
}

export async function updateFamilyMemberDisplayName(client: FamilyClient, rawDisplayName: string): Promise<void> {
  const displayName = normalizeDisplayName(rawDisplayName);
  const { error } = await client.rpc("update_my_family_member_display_name", { p_display_name: displayName });
  if (error) throw new OnboardingError(mapOnboardingError(error));
}

export async function regenerateFamilyJoinCode(client: FamilyClient): Promise<void> {
  const { error } = await client.rpc("regenerate_family_join_code");
  if (error) throw new OnboardingError(mapOnboardingError(error));
}
