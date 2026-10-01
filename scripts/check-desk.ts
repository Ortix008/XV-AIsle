import { getProduct } from "../src/lib/catalog";
import { todayISO } from "../src/lib/dates";
import { emptyDesk } from "../src/lib/desk-state";
import { applyPass, assess } from "../src/lib/engine";
import { buildDeskFixture } from "./fixtures/desk-fixture";
import type { BotId } from "../src/lib/types";

const today = todayISO();
const pan = assess(getProduct("sheet-pan"), today, null);
const labels = assess(getProduct("lid-labels"), today, null);
const press = assess(getProduct("garlic-press"), today, null);
const boxes = assess(getProduct("favor-boxes"), today, null);

if (pan.chosen.supplier.speed !== "us") {
  throw new Error(`sheet pan picked ${pan.chosen.supplier.name}`);
}
if (pan.rows.some((row) => row.supplier.speed === "import" && row.supplier.id === pan.chosen.supplier.id)) {
  throw new Error("sheet pan picked an import");
}
if (labels.chosen.supplier.speed !== "pod") {
  throw new Error(`labels picked ${labels.chosen.supplier.name}`);
}
if (press.chosen.supplier.speed === "import") {
  throw new Error("garlic press fell through to the boat");
}
if (press.chosen.margin >= 0.25) {
  throw new Error(`garlic press margin should be thin, got ${press.chosen.margin}`);
}
if (boxes.chosen.supplier.speed === "import") {
  throw new Error("favor boxes picked a printed import");
}

let state = buildDeskFixture(today);
const before = state.pipeline.length;
state = applyPass(state, "scout", today);
if (state.pipeline[0]?.productId !== "court-towel") {
  throw new Error(`scout filed ${state.pipeline[0]?.productId}`);
}
if (state.pipeline.length !== before + 1) throw new Error("scout did not file");

state = applyPass(state, "listings", today);
if (!state.listings.some((listing) => listing.productId === "shift-towel")) {
  throw new Error("listings did not draft the towels");
}

state = applyPass(state, "orders", today);
const fish = state.orders.find((order) => order.number === "PL-4415");
if (fish?.flag !== "delay" || !fish.reply?.body.includes("need-by")) {
  throw new Error("orders did not flag the spatula");
}

state = applyPass(state, "marketing", today);
const tongs = state.campaigns.find((campaign) => campaign.productId === "tongs");
if (tongs?.posts[0]?.channel !== "X") throw new Error("marketing did not lead with X");

const blank = emptyDesk(today);
const blankArrays = [blank.pipeline, blank.queue, blank.listings, blank.orders, blank.campaigns, blank.log];
if (blankArrays.some((rows) => rows.length !== 0)) throw new Error("a new desk is not empty");

const bots: BotId[] = ["scout", "listings", "orders", "marketing"];
for (const bot of bots) {
  const next = applyPass(blank, bot, today);
  if (next.orders.length !== 0 || next.listings.length !== 0 || next.campaigns.length !== 0) {
    throw new Error(`${bot} filled an empty desk`);
  }
}
const ordersLog = applyPass(blank, "orders", today).log[0]?.text ?? "";
if (!ordersLog.includes("No orders on this desk yet")) {
  throw new Error(`orders log said ${ordersLog}`);
}

console.log("desk checks ok", {
  pan: pan.chosen.supplier.name,
  labels: labels.chosen.supplier.name,
  pressMargin: Math.round(press.chosen.margin * 100),
});
