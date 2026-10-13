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

console.log("account checks ok", { commission: resellerCommissionLabel() });
