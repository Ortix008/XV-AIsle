import type { BotId } from "./types";

export const bots: {
  id: BotId;
  name: string;
  href: string;
  title: string;
  does: string;
  job: string;
}[] = [
  {
    id: "scout",
    name: "Signal",
    href: "/scout",
    title: "Find the product",
    does: "Finds the product",
    job: "Finds a product people already want and a supplier in the US.",
  },
  {
    id: "listings",
    name: "Draft",
    href: "/listings",
    title: "Write the page",
    does: "Writes the page",
    job: "Writes the title, the description, and the price after you say yes.",
  },
  {
    id: "orders",
    name: "Harbor",
    href: "/orders",
    title: "Watch the order",
    does: "Watches the order",
    job: "Tells you if an order is late or arrived broken, and writes the reply.",
  },
  {
    id: "marketing",
    name: "Cast",
    href: "/marketing",
    title: "Write the posts",
    does: "Writes the posts",
    job: "Drafts a post you can copy. You share your shop link anywhere.",
  },
];

export function botById(id: BotId) {
  return bots.find((bot) => bot.id === id) ?? bots[0];
}
