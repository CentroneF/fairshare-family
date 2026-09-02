import type { SupabaseClient } from "@supabase/supabase-js";
import Decimal from "decimal.js";
import {
  createSupabaseFinancialRepository,
  loadMonthlyBalance,
  sumApprovedExpenseAmounts,
  type ActiveParent,
  type FinancialExpenseRow,
} from "./financial-service";
import { isSettlementEligible, parsePlnAmount, type MonthlyBalance } from "./financial-rules";

type ExpenseClient = SupabaseClient;

export class ExpenseBalanceError extends Error {}

export interface ExpenseDisplay {
  id: string;
  description: string;
  expenseDate: string;
  amountPln: string;
  status: "pending" | "approved" | "declined";
  payerId: string;
  payerDisplayName: string | null;
  childId: string | null;
  childName: string | null;
  declineReason: string | null;
  previousDeclineReason: string | null;
  isRecurring: boolean;
}

export interface ExpenseWorkspaceState {
  expenses: readonly ExpenseDisplay[];
  activeParents: readonly ActiveParent[];
  currentMembershipId: string | null;
  balance: MonthlyBalance | null;
  settlement: SettlementState;
}

export type SettlementState =
  | { kind: "unavailable"; isLocked: false; reason: SettlementUnavailableReason }
  | { kind: "eligible"; isLocked: false }
  | { kind: "awaiting-other-parent"; isLocked: true }
  | { kind: "requires-your-confirmation"; isLocked: true }
  | {
      kind: "settled";
      isLocked: true;
      approvedAmount: string;
      firstConfirmedContribution: string;
      secondConfirmedContribution: string;
      paymentAmount: string;
      paymentFromCurrentParent: boolean | null;
    };

export type SettlementUnavailableReason = "current-month" | "one-parent" | "no-expenses" | "pending" | "declined";

export interface CurrentMonthContributionRow {
  parentId: string;
  displayName: string;
  amountPln: string;
}

export interface MonthlyReportHistoryEntry {
  month: string;
  status: "settled" | "unsettled";
  approvedAmount: string;
}

export function isAccessibleHistoricalReportMonth(value: string, currentMonth: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value) && value < currentMonth;
}

interface HistoricalExpenseRow extends FinancialExpenseRow {
  expense_date: string;
}

interface HistoricalSettlementRow {
  report_month: string;
  status: "open" | "settled";
}

interface SettlementRow {
  status: "open" | "settled";
  first_confirmed_by: string | null;
  second_confirmed_by: string | null;
  approved_amount_pln: unknown;
  first_confirmed_contribution_pln: unknown;
  second_confirmed_contribution_pln: unknown;
  payment_from_membership_id: string | null;
  payment_amount_pln: unknown;
}

export function normalizeExpenseAmount(value: string): string {
  const amount = value.trim().replace(",", ".");
  return parsePlnAmount(amount).toFixed(2);
}

export function normalizeExpenseDate(value: string, today = new Date()): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ExpenseBalanceError("Enter an expense date.");
  }
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new ExpenseBalanceError("Enter a valid expense date.");
  }
  const currentDate = today.toISOString().slice(0, 10);
  if (value > currentDate) {
    throw new ExpenseBalanceError("Expense date cannot be in the future.");
  }
  return value;
}

export function validateExpenseDateInMonth(expenseDate: string, month: string, today = new Date()): string {
  const normalizedDate = normalizeExpenseDate(expenseDate, today);
  if (normalizedDate.slice(0, 7) !== month) {
    throw new ExpenseBalanceError("Expense date must be in the displayed month.");
  }
  return normalizedDate;
}

export function normalizeSelectedMonth(value: string | null, today = new Date()): string {
  const currentMonth = today.toISOString().slice(0, 7);
  if (!value) return currentMonth;
  const [year, month] = value.split("-").map(Number);
  if (
    !/^\d{4}-\d{2}$/.test(value) ||
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12 ||
    value > currentMonth
  ) {
    throw new ExpenseBalanceError("Choose the current month or an earlier month.");
  }
  return value;
}

export function mapExpenseError(error: unknown): string {
  if (error instanceof ExpenseBalanceError) return error.message;
  const message =
    error instanceof Error
      ? error.message
      : error && typeof error === "object" && typeof (error as { message?: unknown }).message === "string"
        ? (error as { message: string }).message
        : "";
  if (message.includes("Expense description is required")) return "Enter an expense description.";
  if (message.includes("Amount must be")) return "Enter a positive amount with at most two decimal places.";
  if (message.includes("Expense date cannot")) return "Expense date cannot be in the future.";
  if (message.includes("Expense date must be in the displayed month")) {
    return "Choose an expense date in the displayed month.";
  }
  if (message.includes("Selected child")) return "Choose a child from your family or leave it empty.";
  if (message.includes("Only the other parent")) return "Only the other parent can approve this expense.";
  if (message.includes("Only the payer can update")) return "Only the payer can edit this expense.";
  if (message.includes("Only the payer can delete")) return "Only the payer can delete this expense.";
  if (message.includes("Only pending or declined")) return "Approved expenses cannot be deleted.";
  if (message.includes("confirmation-locked") || message.includes("settled month"))
    return "Expenses in a confirmation-locked or settled month cannot be changed.";
  if (message.includes("already confirmed")) return "You have already confirmed this settlement.";
  if (message.includes("already been settled")) return "This month has already been settled.";
  if (message.includes("All expenses must be approved")) return "Approve every expense before confirming settlement.";
  if (message.includes("Only past months")) return "Only a past month can be settled.";
  if (message.includes("Exactly two active parents"))
    return "Both active parents must be in the family before an expense can be approved.";
  if (message.includes("already been reviewed")) return "This expense has already been reviewed.";
  if (message.includes("not available to this family")) return "This expense is no longer available.";
  if (message.toLowerCase().includes("decline reason")) return "Enter a decline reason of up to 500 characters.";
  if (message.includes("Authentication is required")) return "Please sign in and try again.";
  return "We could not save that expense. Please try again.";
}

export function mapSettlementError(error: unknown): string {
  if (error instanceof ExpenseBalanceError) return error.message;
  const message =
    error instanceof Error
      ? error.message
      : error && typeof error === "object" && typeof (error as { message?: unknown }).message === "string"
        ? (error as { message: string }).message
        : "";
  if (message.includes("already confirmed")) return "You have already confirmed this settlement.";
  if (message.includes("already been settled")) return "This month has already been settled.";
  if (message.includes("A month with no expenses")) return "Add at least one expense before confirming settlement.";
  if (message.includes("All expenses must be approved")) return "Approve every expense before confirming settlement.";
  if (message.includes("Only past months")) return "Only a past month can be settled.";
  if (message.includes("first day of a month")) return "Choose a valid report month.";
  if (message.includes("Exactly two active parents"))
    return "Both active parents must be in the family before confirming settlement.";
  if (message.includes("Authentication is required")) return "Please sign in and try again.";
  if (message.includes("active family membership")) return "Join an active family before confirming settlement.";
  return "We could not confirm this settlement. Please try again.";
}

export function normalizeDeclineReason(value: string): string {
  const reason = value.trim();
  if (!reason || reason.length > 500) throw new ExpenseBalanceError("Enter a decline reason of up to 500 characters.");
  return reason;
}

export function normalizeExpenseId(value: string): string {
  const id = value.trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    throw new ExpenseBalanceError("This expense is no longer available.");
  }
  return id;
}

function parseExpenseDisplayAmount(value: unknown): string | null {
  if (typeof value === "string") {
    try {
      return parsePlnAmount(value).toFixed(2);
    } catch {
      return null;
    }
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    try {
      return parsePlnAmount(value.toString()).toFixed(2);
    } catch {
      return null;
    }
  }

  return null;
}

function parseApprovedReportAmount(value: unknown): string | null {
  const raw =
    typeof value === "string" ? value : typeof value === "number" && Number.isFinite(value) ? value.toString() : null;
  if (raw === null) return null;
  try {
    const amount = new Decimal(raw);
    return amount.isFinite() && amount.greaterThanOrEqualTo(0) && amount.decimalPlaces() <= 2
      ? amount.toFixed(2)
      : null;
  } catch {
    return null;
  }
}

export function mapMonthlyReportHistoryRows(value: unknown): MonthlyReportHistoryEntry[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const report = row as Record<string, unknown>;
    const approvedAmount = parseApprovedReportAmount(report.approved_amount);
    if (
      typeof report.report_month !== "string" ||
      !approvedAmount ||
      (report.status !== "open" && report.status !== "settled")
    ) {
      return [];
    }
    return [
      {
        month: report.report_month.slice(0, 7),
        status: report.status === "settled" ? "settled" : "unsettled",
        approvedAmount,
      },
    ];
  });
}

export function deriveMonthlyReportHistory(input: {
  expenses: readonly HistoricalExpenseRow[];
  settlements: readonly HistoricalSettlementRow[];
  currentMonth: string;
}): MonthlyReportHistoryEntry[] {
  const expensesByMonth = new Map<string, HistoricalExpenseRow[]>();
  for (const expense of input.expenses) {
    const month = expense.expense_date.slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(month) || month >= input.currentMonth) continue;
    const existing = expensesByMonth.get(month) ?? [];
    existing.push(expense);
    expensesByMonth.set(month, existing);
  }

  const settlementsByMonth = new Map<string, HistoricalSettlementRow>();
  for (const settlement of input.settlements) {
    const month = settlement.report_month.slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(month) || month >= input.currentMonth) continue;
    settlementsByMonth.set(month, settlement);
  }

  return [...new Set([...expensesByMonth.keys(), ...settlementsByMonth.keys()])]
    .sort((first, second) => second.localeCompare(first))
    .map((month) => ({
      month,
      status: settlementsByMonth.get(month)?.status === "settled" ? "settled" : "unsettled",
      approvedAmount: sumApprovedExpenseAmounts(expensesByMonth.get(month) ?? []).toFixed(2),
    }));
}

export async function createExpense(
  client: ExpenseClient,
  input: { childId: string | null; description: string; expenseDate: string; amount: string },
): Promise<void> {
  const description = input.description.trim();
  if (!description) throw new ExpenseBalanceError("Enter an expense description.");
  const amount = normalizeExpenseAmount(input.amount);
  const expenseDate = normalizeExpenseDate(input.expenseDate);
  const { error } = await client.rpc("create_expense", {
    p_child_id: input.childId,
    p_description: description,
    p_expense_date: expenseDate,
    p_amount_pln: amount,
  });
  if (error) throw new ExpenseBalanceError(mapExpenseError(error));
}

export async function approveExpense(client: ExpenseClient, rawExpenseId: string): Promise<void> {
  const expenseId = normalizeExpenseId(rawExpenseId);
  const { error } = await client.rpc("approve_expense", { p_expense_id: expenseId });
  if (error) throw new ExpenseBalanceError(mapExpenseError(error));
}

export async function declineExpense(client: ExpenseClient, rawExpenseId: string, rawReason: string): Promise<void> {
  const expenseId = normalizeExpenseId(rawExpenseId);
  const reason = normalizeDeclineReason(rawReason);
  const { error } = await client.rpc("decline_expense", { p_expense_id: expenseId, p_reason: reason });
  if (error) throw new ExpenseBalanceError(mapExpenseError(error));
}

export async function updateExpense(
  client: ExpenseClient,
  input: { expenseId: string; childId: string | null; description: string; expenseDate: string; amount: string },
): Promise<void> {
  const expenseId = normalizeExpenseId(input.expenseId);
  const description = input.description.trim();
  if (!description) throw new ExpenseBalanceError("Enter an expense description.");
  const amount = normalizeExpenseAmount(input.amount);
  const expenseDate = normalizeExpenseDate(input.expenseDate);
  const { error } = await client.rpc("update_expense", {
    p_expense_id: expenseId,
    p_child_id: input.childId,
    p_description: description,
    p_expense_date: expenseDate,
    p_amount_pln: amount,
  });
  if (error) throw new ExpenseBalanceError(mapExpenseError(error));
}

export async function deleteExpense(client: ExpenseClient, rawExpenseId: string): Promise<void> {
  const expenseId = normalizeExpenseId(rawExpenseId);
  const { error } = await client.rpc("delete_expense", { p_expense_id: expenseId });
  if (error) throw new ExpenseBalanceError(mapExpenseError(error));
}

export async function confirmMonthlySettlement(client: ExpenseClient, rawMonth: string): Promise<void> {
  const month = normalizeSelectedMonth(rawMonth);
  const { error } = await client.rpc("confirm_monthly_settlement", { p_report_month: `${month}-01` });
  if (error) throw new ExpenseBalanceError(mapSettlementError(error));
}

async function loadCurrentMembershipId(
  client: ExpenseClient,
  familyId: string,
  userId: string,
): Promise<string | null> {
  const result = await client
    .from("family_members")
    .select("id")
    .eq("family_id", familyId)
    .eq("user_id", userId)
    .eq("role", "parent")
    .eq("is_active", true)
    .maybeSingle();
  if (result.error) throw new ExpenseBalanceError("We could not load the family balance.");
  const value = result.data as unknown;
  return value && typeof value === "object" && typeof (value as { id?: unknown }).id === "string"
    ? (value as { id: string }).id
    : null;
}

async function loadSettlementRow(
  client: ExpenseClient,
  familyId: string,
  month: string,
): Promise<SettlementRow | null> {
  const result = await client
    .from("monthly_settlements")
    .select(
      "status, first_confirmed_by, second_confirmed_by, approved_amount_pln, first_confirmed_contribution_pln, second_confirmed_contribution_pln, payment_from_membership_id, payment_amount_pln",
    )
    .eq("family_id", familyId)
    .eq("report_month", `${month}-01`)
    .maybeSingle();
  if (result.error) throw new ExpenseBalanceError("We could not load the family balance.");
  const value = result.data as unknown;
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (
    (row.status !== "open" && row.status !== "settled") ||
    (row.first_confirmed_by !== null && typeof row.first_confirmed_by !== "string") ||
    (row.second_confirmed_by !== null && typeof row.second_confirmed_by !== "string") ||
    (row.payment_from_membership_id !== null && typeof row.payment_from_membership_id !== "string")
  ) {
    return null;
  }
  return {
    status: row.status,
    first_confirmed_by: row.first_confirmed_by,
    second_confirmed_by: row.second_confirmed_by,
    approved_amount_pln: row.approved_amount_pln,
    first_confirmed_contribution_pln: row.first_confirmed_contribution_pln,
    second_confirmed_contribution_pln: row.second_confirmed_contribution_pln,
    payment_from_membership_id: row.payment_from_membership_id,
    payment_amount_pln: row.payment_amount_pln,
  };
}

export function getSettlementUnavailableReason(input: {
  expenses: readonly Pick<ExpenseDisplay, "status">[];
  parentIds: readonly string[];
  month: string;
  currentMonth: string;
}): SettlementUnavailableReason | null {
  if (input.month >= input.currentMonth) return "current-month";
  if (new Set(input.parentIds).size !== 2 || input.parentIds.length !== 2) return "one-parent";
  if (input.expenses.length === 0) return "no-expenses";
  if (input.expenses.some((expense) => expense.status === "pending")) return "pending";
  if (input.expenses.some((expense) => expense.status === "declined")) return "declined";
  return null;
}

export function shouldRenderUnavailableSettlementPanel(settlement: SettlementState): boolean {
  return settlement.kind === "unavailable" && settlement.reason !== "current-month";
}

export function getCurrentMonthContributionRows(input: {
  activeParents: readonly ActiveParent[];
  balance: MonthlyBalance | null;
  month: string;
  currentMonth: string;
}): CurrentMonthContributionRow[] {
  if (input.month !== input.currentMonth || input.balance === null || input.activeParents.length !== 2) return [];
  return input.activeParents.map((parent) => ({
    parentId: parent.id,
    displayName: parent.displayName ?? "Parent",
    amountPln: (input.balance.contributions.get(parent.id) ?? new Decimal(0)).toFixed(2),
  }));
}

export function deriveSettlementState(input: {
  row: SettlementRow | null;
  expenses: readonly ExpenseDisplay[];
  parentIds: readonly string[];
  currentMembershipId: string | null;
  balance: MonthlyBalance | null;
  month: string;
  today?: Date;
}): SettlementState {
  if (input.row?.status === "settled") {
    const approvedAmount = parseApprovedReportAmount(input.row.approved_amount_pln);
    const firstConfirmedContribution = parseApprovedReportAmount(input.row.first_confirmed_contribution_pln);
    const secondConfirmedContribution = parseApprovedReportAmount(input.row.second_confirmed_contribution_pln);
    const paymentAmount = parseApprovedReportAmount(input.row.payment_amount_pln);
    if (!approvedAmount || !firstConfirmedContribution || !secondConfirmedContribution || !paymentAmount) {
      throw new ExpenseBalanceError("We could not load the family balance.");
    }
    return {
      kind: "settled",
      isLocked: true,
      approvedAmount,
      firstConfirmedContribution,
      secondConfirmedContribution,
      paymentAmount: new Decimal(paymentAmount).toFixed(0),
      paymentFromCurrentParent:
        input.row.payment_from_membership_id === null
          ? null
          : input.row.payment_from_membership_id === input.currentMembershipId,
    };
  }

  if (input.row?.first_confirmed_by) {
    return {
      kind:
        input.row.first_confirmed_by === input.currentMembershipId
          ? "awaiting-other-parent"
          : "requires-your-confirmation",
      isLocked: true,
    };
  }

  const today = input.today ?? new Date();
  const unavailableReason = getSettlementUnavailableReason({
    expenses: input.expenses,
    parentIds: input.parentIds,
    month: input.month,
    currentMonth: today.toISOString().slice(0, 7),
  });
  const eligible =
    unavailableReason === null &&
    input.balance !== null &&
    isSettlementEligible({
      expenses: input.expenses.map((expense) => ({
        amountPln: expense.amountPln,
        payerId: expense.payerId,
        status: expense.status,
      })),
      parentIds: input.parentIds,
      reportMonth: new Date(`${input.month}-01T00:00:00Z`),
      today,
    });
  return eligible
    ? { kind: "eligible", isLocked: false }
    : { kind: "unavailable", isLocked: false, reason: unavailableReason ?? "pending" };
}

export async function loadMonthlyReportHistory(
  client: ExpenseClient,
  input: { familyId: string; currentMonth: string },
): Promise<MonthlyReportHistoryEntry[]> {
  const result = await client.rpc("list_monthly_report_history", {
    p_family_id: input.familyId,
    p_before_month: `${input.currentMonth}-01`,
  });
  if (result.error) {
    throw new ExpenseBalanceError("We could not load the report history.");
  }
  return mapMonthlyReportHistoryRows(result.data);
}

export async function loadExpenseWorkspaceState(
  client: ExpenseClient,
  input: { familyId: string; userId: string; month: string },
): Promise<ExpenseWorkspaceState> {
  const repository = createSupabaseFinancialRepository(client);
  const [expenses, activeParents, currentMembershipId, settlementRow] = await Promise.all([
    listMonthExpenses(client, input.familyId, input.month),
    repository.listActiveParents(input.familyId, input.userId),
    loadCurrentMembershipId(client, input.familyId, input.userId),
    loadSettlementRow(client, input.familyId, input.month),
  ]);
  const balance =
    activeParents.length === 2
      ? await loadMonthlyBalance({
          repository,
          familyId: input.familyId,
          userId: input.userId,
          month: input.month,
          activeParents,
        })
      : null;
  return {
    expenses,
    activeParents,
    currentMembershipId,
    balance,
    settlement: deriveSettlementState({
      row: settlementRow,
      expenses,
      parentIds: activeParents.map((parent) => parent.id),
      currentMembershipId,
      balance,
      month: input.month,
    }),
  };
}

export async function listMonthExpenses(
  client: ExpenseClient,
  familyId: string,
  month: string,
): Promise<ExpenseDisplay[]> {
  const [year, monthNumber] = month.split("-").map(Number);
  const nextMonth = new Date(Date.UTC(year, monthNumber, 1)).toISOString().slice(0, 10);
  const start = `${month}-01`;
  const result = await client
    .from("expenses")
    .select(
      "id, child_id, description, expense_date, amount_pln, status, payer_id, decline_reason, previous_decline_reason, children(name), payer:family_members!expenses_payer_id_family_id_fkey(display_name), recurring_expense_occurrences(id)",
    )
    .eq("family_id", familyId)
    .gte("expense_date", start)
    .lt("expense_date", nextMonth)
    .order("created_at", { ascending: false });
  if (result.error) throw new ExpenseBalanceError(mapExpenseError(result.error));
  const rows = result.data as unknown;
  if (!Array.isArray(rows)) return [];
  return mapExpenseDisplayRows(rows);
}

export function mapExpenseDisplayRows(rows: readonly unknown[]): ExpenseDisplay[] {
  return rows.flatMap((row) => {
    if (typeof row !== "object" || row === null) return [];
    const value = row as Record<string, unknown>;
    const child: unknown = Array.isArray(value.children) ? value.children[0] : value.children;
    const payer: unknown = Array.isArray(value.payer) ? value.payer[0] : value.payer;
    const occurrences = value.recurring_expense_occurrences;
    const amountPln = parseExpenseDisplayAmount(value.amount_pln);
    if (
      typeof value.id !== "string" ||
      typeof value.description !== "string" ||
      typeof value.expense_date !== "string" ||
      !amountPln ||
      typeof value.payer_id !== "string" ||
      (value.child_id !== null && typeof value.child_id !== "string") ||
      (value.status !== "pending" && value.status !== "approved" && value.status !== "declined")
    ) {
      return [];
    }
    return [
      {
        id: value.id,
        description: value.description,
        expenseDate: value.expense_date,
        amountPln,
        status: value.status,
        payerId: value.payer_id,
        payerDisplayName:
          payer && typeof payer === "object" && typeof (payer as { display_name?: unknown }).display_name === "string"
            ? (payer as { display_name: string }).display_name
            : null,
        childId: typeof value.child_id === "string" ? value.child_id : null,
        declineReason: typeof value.decline_reason === "string" ? value.decline_reason : null,
        previousDeclineReason: typeof value.previous_decline_reason === "string" ? value.previous_decline_reason : null,
        isRecurring: Array.isArray(occurrences)
          ? occurrences.some((occurrence) => occurrence && typeof occurrence === "object")
          : Boolean(occurrences && typeof occurrences === "object"),
        childName:
          child && typeof child === "object" && typeof (child as { name?: unknown }).name === "string"
            ? (child as { name: string }).name
            : null,
      },
    ];
  });
}
