import type { BotId, Lane } from "./types";

export const marketArt = "/art/market-hero.png";

export const botArt: Record<BotId, string> = {
  scout: "/art/bot-signal.png",
  listings: "/art/bot-draft.png",
  orders: "/art/bot-harbor.png",
  marketing: "/art/bot-cast.png",
};

export const welcomeHero = "/art/welcome-life.png";

export const welcomeTeam: Record<BotId, string> = {
  scout: "/art/real-signal.png",
  listings: "/art/real-draft.png",
  orders: "/art/real-harbor.png",
  marketing: "/art/real-cast.png",
};

export const welcomeDepartments = [
  {
    title: "Kitchen",
    src: "/art/dept-kitchen-tools.png",
    line: "Cooking gadgets and what organizes the kitchen. Not fresh food.",
  },
  { title: "Clothing", src: "/art/real-clothes.png", line: "Clothes that ship from here." },
  {
    title: "Home",
    src: "/art/dept-home-wide.png",
    line: "What a home uses, from storage to the lamp, the broom, and the table.",
  },
  { title: "Sports", src: "/art/real-sport.png", line: "Gear for the hour after work." },
  {
    title: "Health",
    src: "/art/dept-health-tools.png",
    line: "Gadgets and tools. Not medicine.",
  },
  { title: "Seasonal", src: "/art/dept-seasonal.png", line: "The extra for a gathering." },
  {
    title: "Garden",
    src: "/art/dept-garden-tools.png",
    line: "Tools for working the garden. Not plants.",
  },
  { title: "Electronics", src: "/art/dept-electronics.png", line: "Small gear for the desk and the day." },
] as const;

export const welcomeReach = [
  {
    src: "/art/real-local.png",
    title: "Local business",
    line: "A neighborhood shop packs the order and reaches people past the block.",
  },
  {
    src: "/art/real-enterprise.png",
    title: "Big companies",
    line: "A national floor already holds the stock. The demand finds it.",
  },
] as const;

export const laneArt: Record<Lane, string> = {
  kitchen: "/art/lane-kitchen.png",
  apparel: "/art/lane-apparel.png",
  sport: "/art/lane-sport.png",
  utility: "/art/lane-utility.png",
  food: "/art/lane-food.png",
  "party-extra": "/art/lane-party.png",
};

export const parties = [
  {
    src: "/art/party-seller-real.png",
    title: "You, the seller",
    body: "You pick the product and the post. You do not pack a box or buy a warehouse.",
  },
  {
    src: "/art/party-supplier-real.png",
    title: "The middleman",
    body: "The supplier gets a real order and ships it from a US warehouse or a print shop.",
  },
  {
    src: "/art/party-company-real.png",
    title: "The company",
    body: "XVAIsle keeps the market, and the SI Team keeps finding the next thing people want.",
  },
] as const;
