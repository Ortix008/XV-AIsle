import { canKeepBotsRunning, planStatus, trialDaysLeft, TRIAL_MS } from "../src/lib/account";

const now = Date.UTC(2026, 8, 29);
const fresh = { createdAt: now - 2 * 24 * 60 * 60 * 1000, memberSince: null };
const expired = { createdAt: now - TRIAL_MS - 1000, memberSince: null };
const member = { createdAt: now - TRIAL_MS - 1000, memberSince: now };

if (planStatus(fresh, now) !== "trial") throw new Error("fresh account should be in the free month");
if (trialDaysLeft(fresh, now) < 27) throw new Error("free month should have most days left");
if (planStatus(expired, now) !== "closed") throw new Error("ended month should close the market");
if (planStatus(member, now) !== "member") throw new Error("membership should keep a closed month open");
if (canKeepBotsRunning("trial") || canKeepBotsRunning("closed")) {
  throw new Error("only members leave the bots on");
}
if (!canKeepBotsRunning("member")) throw new Error("members can leave the bots on");

console.log("account checks ok", { days: trialDaysLeft(fresh, now) });
