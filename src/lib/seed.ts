import { getProduct } from "./catalog";
import { addDays } from "./dates";
import {
  assess,
  buildCampaign,
  buildListing,
  draftDelayReply,
  draftQualityReply,
} from "./engine";
import { round2 } from "./money";
import type { DeskState, Order, PipelineItem } from "./types";

function item(
  productId: string,
  status: PipelineItem["status"],
  discoveredOn: string,
): PipelineItem {
  return { productId, status, discoveredOn, pickedSupplierId: null };
}

function order(
  input: Omit<Order, "reply" | "issue" | "flag"> & {
    flag?: Order["flag"];
    issue?: string | null;
  },
): Order {
  return {
    ...input,
    flag: input.flag ?? null,
    issue: input.issue ?? null,
    reply: null,
  };
}

export function buildSeed(today: string): DeskState {
  const fishListing = buildListing(getProduct("fish-spatula"), today);
  fishListing.status = "ready";
  const tongListing = buildListing(getProduct("tongs"), today);
  tongListing.status = "ready";
  const apronListing = buildListing(getProduct("apron"), today);

  const panPrice = assess(getProduct("sheet-pan"), today).chosen.list;
  const apronPrice = apronListing.prices.find((price) => price.id === "target")?.retail ?? 0;
  const fishPrice = fishListing.prices.find((price) => price.id === "target")?.retail ?? 0;
  const tongPrice = tongListing.prices.find((price) => price.id === "target")?.retail ?? 0;
  const labelPrice = assess(getProduct("lid-labels"), today).chosen.list;
  const scraperPrice = assess(getProduct("bench-scraper"), today).chosen.list;

  const pan = order({
    id: "ord-4412",
    number: "PL-4412",
    customer: "Sample buyer 1",
    email: "buyer1@example.com",
    productId: "sheet-pan",
    productName: "Quarter sheet pan and rack",
    qty: 1,
    merchandise: panPrice,
    shippingPaid: 6.4,
    placedOn: addDays(today, -12),
    carrier: "UPS",
    tracking: "SAMPLE-TRACK-4412",
    eta: addDays(today, -3),
    needBy: addDays(today, 1),
    status: "delayed",
    flag: "delay",
    issue: "No delivery scan inside the original window.",
  });
  pan.reply = draftDelayReply(pan);

  const apron = order({
    id: "ord-4407",
    number: "PL-4407",
    customer: "Sample buyer 2",
    email: "buyer2@example.com",
    productId: "apron",
    productName: "Unbleached canvas waist apron",
    qty: 1,
    merchandise: apronPrice,
    shippingPaid: 4.2,
    placedOn: addDays(today, -9),
    carrier: "USPS",
    tracking: "SAMPLE-TRACK-4407",
    eta: addDays(today, -1),
    needBy: addDays(today, 4),
    status: "quality",
    flag: "quality",
    issue: "The waist apron arrived with a tear at the pocket stitch.",
  });
  apron.reply = draftQualityReply(apron);

  const fish = order({
    id: "ord-4415",
    number: "PL-4415",
    customer: "Sample buyer 3",
    email: "buyer3@example.com",
    productId: "fish-spatula",
    productName: "Slotted fish spatula",
    qty: 1,
    merchandise: fishPrice,
    shippingPaid: 4.8,
    placedOn: addDays(today, -8),
    carrier: "USPS",
    tracking: "SAMPLE-TRACK-4415",
    eta: addDays(today, -1),
    needBy: addDays(today, 3),
    status: "in_transit",
  });

  const tongs = order({
    id: "ord-4418",
    number: "PL-4418",
    customer: "Sample buyer 4",
    email: "buyer4@example.com",
    productId: "tongs",
    productName: "Locking tongs, 12 in",
    qty: 1,
    merchandise: tongPrice,
    shippingPaid: 4.9,
    placedOn: addDays(today, -4),
    carrier: "UPS",
    tracking: "SAMPLE-TRACK-4418",
    eta: addDays(today, 3),
    needBy: addDays(today, 12),
    status: "in_transit",
  });

  const labels = order({
    id: "ord-4421",
    number: "PL-4421",
    customer: "Sample buyer 5",
    email: "buyer5@example.com",
    productId: "lid-labels",
    productName: "Deli container labels, 48",
    qty: 2,
    merchandise: round2(labelPrice * 2),
    shippingPaid: 3.8,
    placedOn: addDays(today, -1),
    carrier: "USPS",
    tracking: "SAMPLE-TRACK-4421",
    eta: addDays(today, 4),
    needBy: addDays(today, 9),
    status: "processing",
  });

  const scraper = order({
    id: "ord-4399",
    number: "PL-4399",
    customer: "Sample buyer 6",
    email: "buyer6@example.com",
    productId: "bench-scraper",
    productName: "Stainless bench scraper",
    qty: 1,
    merchandise: scraperPrice,
    shippingPaid: 4.1,
    placedOn: addDays(today, -16),
    carrier: "USPS",
    tracking: "SAMPLE-TRACK-4399",
    eta: addDays(today, -9),
    needBy: addDays(today, -8),
    status: "delivered",
  });

  return {
    version: 3,
    seededOn: today,
    bots: {
      scout: { running: false },
      listings: { running: false },
      orders: { running: false },
      marketing: { running: false },
    },
    pipeline: [
      item("sheet-pan", "review", addDays(today, -2)),
      item("bench-scraper", "review", addDays(today, -2)),
      item("lid-labels", "review", addDays(today, -1)),
      item("splatter", "review", addDays(today, -1)),
      item("shift-towel", "approved", addDays(today, -3)),
      item("apron", "approved", addDays(today, -4)),
      item("fish-spatula", "approved", addDays(today, -5)),
      item("tongs", "approved", addDays(today, -3)),
      item("garlic-press", "passed", addDays(today, -4)),
    ],
    queue: ["court-towel", "cord-clips", "citrus-press", "favor-boxes", "heavy-tee"],
    listings: [apronListing, fishListing, tongListing],
    orders: [fish, pan, apron, tongs, labels, scraper],
    campaigns: [buildCampaign(getProduct("fish-spatula"), fishListing)],
    log: [
      {
        id: "seed-scout",
        at: Date.now() - 1000 * 60 * 60 * 26,
        bot: "scout",
        text: "Skipped the garlic press. The US price keeps too little, and the overseas one takes three weeks on a boat.",
      },
      {
        id: "seed-orders",
        at: Date.now() - 1000 * 60 * 60 * 20,
        bot: "orders",
        text: "Flagged PL-4412 as late and drafted a reply for Sample buyer 1. PL-4415 has not been checked on this pass.",
      },
    ],
    recheck: 0,
    selected: {
      scout: "sheet-pan",
      listing: "apron",
      order: "ord-4412",
      marketing: "fish-spatula",
    },
  };
}
