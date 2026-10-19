import { accountSupportRef } from "../src/lib/account";
import { publishDenial, type Actor } from "../src/lib/server/access";
import { RESELLER_COMMISSION_BPS, RESELLER_DISCLOSURE, resellerCommissionLabel } from "../src/lib/policies";

const reseller: Actor = {
  id: "reseller",
  role: "reseller",
  memberSince: null,
  membershipStatus: null,
  emailVerified: true,
  totpEnabled: false,
};

const open = publishDenial(reseller, true);
if (open !== null) throw new Error("publishing works without a membership");

const payout = publishDenial(reseller, false);
if (payout !== "Finish Stripe payout setup before publishing.") {
  throw new Error("payout setup is still required");
}
if (payout.toLowerCase().includes("membership")) throw new Error("publish denial should not mention membership");

const buyer = publishDenial({ ...reseller, role: "buyer" }, true);
if (buyer !== "Only a reseller can publish a listing.") throw new Error("a buyer still cannot publish");

if (RESELLER_COMMISSION_BPS !== 500) throw new Error("reseller commission is 5%");
if (resellerCommissionLabel() !== "5%") throw new Error("the reseller page reads the commission constant");
if (RESELLER_DISCLOSURE !== "#ad, I earn a commission.") throw new Error("the disclosure line changed");

const sampleId = "11111111-2222-3333-4444-555555a3f9c2";
if (accountSupportRef(sampleId) !== "Ref …a3f9c2") throw new Error("support ref uses the last 6 characters");
if (accountSupportRef(sampleId).includes("11111111")) throw new Error("support ref leaked the account id");

console.log("account checks ok", { commission: resellerCommissionLabel() });

async function checkPasswordReset() {
  process.env.DATABASE_PATH = ":memory:";
  const { signUp, requestPasswordReset, consumePasswordReset, signIn } = await import("../src/lib/server/accounts");
  const { startMailCapture, stopMailCapture } = await import("../src/lib/server/mail");
  const { getDb } = await import("../src/lib/server/db");

  const created = signUp({ name: "Reset Buyer", email: "reset-buyer@example.com", password: "old-password" });
  if ("error" in created) throw new Error(created.error);
  const captured = startMailCapture();
  const logs: string[] = [];
  const original = console.info;
  console.info = (...args: unknown[]) => {
    logs.push(args.map((part) => String(part)).join(" "));
  };
  const asked = await requestPasswordReset("reset-buyer@example.com");
  const missing = await requestPasswordReset("nobody@example.com");
  console.info = original;
  stopMailCapture();
  if (!asked.ok || !missing.ok) throw new Error("a reset request always answers the same way");
  const resetMail = captured.filter((message) => message.subject === "Reset your XV-AIsle password");
  if (resetMail.length !== 1) throw new Error("password reset emails one link");
  const token = resetMail[0]?.text.match(/token=([a-f0-9]+)/)?.[1] ?? "";
  if (!resetMail[0]?.text.includes("/reset/confirm?token=") || token.length < 32) {
    throw new Error("password reset sends an email reset link");
  }
  if (logs.some((line) => line.includes(token))) throw new Error("the reset token is not logged");
  const stored = getDb().prepare("SELECT token_hash FROM password_resets").all() as { token_hash: string }[];
  if (stored.length !== 1 || stored[0]?.token_hash === token || stored[0]?.token_hash.length !== 64) {
    throw new Error("the reset token is stored as a hash");
  }
  const weak = consumePasswordReset(token, "short");
  if (!("error" in weak)) throw new Error("a short password is refused");
  const saved = consumePasswordReset(token, "new-password");
  if ("error" in saved) throw new Error(saved.error);
  const reused = consumePasswordReset(token, "another-password");
  if (!("error" in reused)) throw new Error("a reset link works once");
  const signedIn = signIn({ email: "reset-buyer@example.com", password: "new-password" });
  if ("error" in signedIn) throw new Error("the new password signs in");
  const oldPassword = signIn({ email: "reset-buyer@example.com", password: "old-password" });
  if (!("error" in oldPassword)) throw new Error("the old password stops working");
  console.log("password reset emails a one-time link");
}

checkPasswordReset().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
