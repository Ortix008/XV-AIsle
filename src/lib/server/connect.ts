import { randomUUID } from "node:crypto";
import type { PublicAccount } from "./accounts";
import { getDb } from "./db";
import {
  appOrigin,
  createLoginLink,
  createOnboardingLink,
  createRecipientAccount,
  retrieveConnectedAccount,
  stripeConfigured,
} from "./stripe";

export type ConnectedAccount = {
  accountId: string;
  stripeAccountId: string;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  requirementsDue: string;
  transfersStatus: string;
  updatedAt: number;
};

type ConnectedRow = {
  account_id: string;
  stripe_account_id: string;
  charges_enabled: number;
  payouts_enabled: number;
  details_submitted: number;
  requirements_due: string;
  transfers_status: string;
  updated_at: number;
};

function fromRow(row: ConnectedRow): ConnectedAccount {
  return {
    accountId: row.account_id,
    stripeAccountId: row.stripe_account_id,
    chargesEnabled: row.charges_enabled === 1,
    payoutsEnabled: row.payouts_enabled === 1,
    detailsSubmitted: row.details_submitted === 1,
    requirementsDue: row.requirements_due,
    transfersStatus: row.transfers_status,
    updatedAt: row.updated_at,
  };
}

export function connectReady(account: ConnectedAccount | null) {
  if (!account) return false;
  return account.transfersStatus === "active" || account.payoutsEnabled;
}

export function getConnected(accountId: string) {
  const row = getDb().prepare("SELECT * FROM connected_accounts WHERE account_id = ?").get(accountId) as
    | ConnectedRow
    | undefined;
  return row ? fromRow(row) : null;
}

export function getConnectedByStripeId(stripeAccountId: string) {
  const row = getDb()
    .prepare("SELECT * FROM connected_accounts WHERE stripe_account_id = ?")
    .get(stripeAccountId) as ConnectedRow | undefined;
  return row ? fromRow(row) : null;
}

function dig(value: unknown, ...path: string[]): unknown {
  let current = value;
  for (const key of path) {
    if (!current || typeof current !== "object" || Array.isArray(current)) return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

export function readTransfersStatus(payload: unknown) {
  const status = dig(
    payload,
    "configuration",
    "recipient",
    "capabilities",
    "stripe_balance",
    "stripe_transfers",
    "status",
  );
  if (typeof status === "string" && status) return status;
  if (dig(payload, "payouts_enabled") === true) return "active";
  return "pending";
}

function requirementsDue(payload: unknown) {
  const entries = dig(payload, "requirements", "entries");
  if (Array.isArray(entries)) {
    return entries
      .map((entry) => {
        if (!entry || typeof entry !== "object") return "";
        const description = (entry as { description?: unknown }).description;
        return typeof description === "string" ? description : "";
      })
      .filter(Boolean)
      .join("; ")
      .slice(0, 500);
  }
  const currently = dig(payload, "requirements", "currently_due");
  if (!Array.isArray(currently)) return "";
  return currently
    .filter((item): item is string => typeof item === "string")
    .join(", ")
    .slice(0, 500);
}

export function saveCapability(stripeAccountId: string, payload: unknown) {
  const transfersStatus = readTransfersStatus(payload);
  const charges = dig(payload, "charges_enabled") === true ? 1 : 0;
  const detailsFlag = dig(payload, "details_submitted");
  const details = detailsFlag === true || transfersStatus === "active" ? 1 : 0;
  getDb()
    .prepare(
      `UPDATE connected_accounts
       SET charges_enabled = ?, payouts_enabled = ?, details_submitted = ?, requirements_due = ?,
           transfers_status = ?, updated_at = ?
       WHERE stripe_account_id = ?`,
    )
    .run(
      charges,
      transfersStatus === "active" ? 1 : 0,
      details,
      requirementsDue(payload),
      transfersStatus,
      Date.now(),
      stripeAccountId,
    );
  return getConnectedByStripeId(stripeAccountId);
}

function rememberAccount(accountId: string, stripeAccountId: string) {
  getDb()
    .prepare(
      `INSERT INTO connected_accounts (
         account_id, stripe_account_id, charges_enabled, payouts_enabled, details_submitted,
         requirements_due, transfers_status, updated_at
       ) VALUES (?, ?, 0, 0, 0, '', 'pending', ?)
       ON CONFLICT(account_id) DO UPDATE SET
         stripe_account_id = excluded.stripe_account_id,
         updated_at = excluded.updated_at`,
    )
    .run(accountId, stripeAccountId, Date.now());
}

export async function refreshConnected(stripeAccountId: string) {
  const payload = await retrieveConnectedAccount(stripeAccountId);
  return saveCapability(stripeAccountId, payload);
}

export function disableConnected(stripeAccountId: string) {
  getDb()
    .prepare(
      `UPDATE connected_accounts
       SET charges_enabled = 0, payouts_enabled = 0, transfers_status = 'disabled', updated_at = ?
       WHERE stripe_account_id = ?`,
    )
    .run(Date.now(), stripeAccountId);
}

export async function beginOnboarding(account: PublicAccount) {
  if (!stripeConfigured()) return { status: 503 as const, error: "Stripe is not configured." };
  if (account.role === "buyer") {
    return { status: 400 as const, error: "Choose reseller or supplier before payout setup." };
  }
  let row = getConnected(account.id);
  if (!row) {
    const created = (await createRecipientAccount({
      email: account.email,
      name: account.name,
      idempotencyKey: `connect-account-${account.id}`,
    })) as { id?: string };
    if (!created.id) return { status: 502 as const, error: "Stripe did not create a payout account." };
    rememberAccount(account.id, created.id);
    saveCapability(created.id, created);
    row = getConnected(account.id);
  }
  if (!row) return { status: 500 as const, error: "The payout account was not saved." };
  const origin = appOrigin();
  const url = await createOnboardingLink({
    stripeAccountId: row.stripeAccountId,
    refreshUrl: `${origin}/api/connect/refresh`,
    returnUrl: `${origin}/api/connect/return`,
    idempotencyKey: `connect-link-${account.id}-${randomUUID()}`,
  });
  return { status: 200 as const, url };
}

export async function beginDashboard(account: PublicAccount) {
  if (!stripeConfigured()) return { status: 503 as const, error: "Stripe is not configured." };
  const row = getConnected(account.id);
  if (!row) return { status: 400 as const, error: "Set up payouts before opening the Stripe dashboard." };
  const url = await createLoginLink(row.stripeAccountId);
  return { status: 200 as const, url };
}
