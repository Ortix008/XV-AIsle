export type FloorStatus = "open" | "copied" | "talking" | "shipping" | "passed";

export type EnterpriseFloor = {
  id: string;
  name: string;
  holds: string;
  reachUrl: string;
};

export const floorStatuses: { id: FloorStatus; label: string }[] = [
  { id: "open", label: "Not yet" },
  { id: "copied", label: "Note copied" },
  { id: "talking", label: "Talking" },
  { id: "shipping", label: "They will ship" },
  { id: "passed", label: "Passed" },
];

/**
 * Largest US retailers that can put goods in front of the country.
 * Public pages only. XVAIsle does not log in, and none of these are a live connection.
 */
export const enterpriseFloors: EnterpriseFloor[] = [
  {
    id: "walmart",
    name: "Walmart",
    holds: "The largest US retailer. Ask them to feature goods made in the USA from stock they already hold.",
    reachUrl: "https://marketplace.walmart.com",
  },
  {
    id: "amazon",
    name: "Amazon",
    holds: "US marketplace stock and warehouses. The ask is for products made in the USA, not a three-week boat.",
    reachUrl: "https://sell.amazon.com",
  },
  {
    id: "costco",
    name: "Costco",
    holds: "Warehouse clubs across the US. Ask them to carry made-in-USA goods members can take home.",
    reachUrl: "https://www.costco.com",
  },
  {
    id: "kroger",
    name: "Kroger",
    holds: "A national grocer. Food tools and household goods made in the USA can sit with the weekly shop.",
    reachUrl: "https://www.thekrogerco.com",
  },
  {
    id: "home-depot",
    name: "Home Depot",
    holds: "The largest US home-improvement floor. Tools and house goods made here can ship from their stock.",
    reachUrl: "https://www.homedepot.com",
  },
  {
    id: "walgreens",
    name: "Walgreens",
    holds: "Drugstores on corners across the US. Everyday goods made here can ride with a neighborhood trip.",
    reachUrl: "https://www.walgreens.com",
  },
  {
    id: "cvs",
    name: "CVS",
    holds: "A national drugstore floor. The ask is for US-made everyday goods they already know how to ship.",
    reachUrl: "https://www.cvs.com",
  },
  {
    id: "target",
    name: "Target",
    holds: "National floor inventory through Target Plus, with room for goods made in the USA.",
    reachUrl: "https://plus.target.com",
  },
  {
    id: "lowes",
    name: "Lowe's",
    holds: "Home improvement stores across the US. Ask them to ship tools and house goods made here.",
    reachUrl: "https://www.lowes.com",
  },
  {
    id: "albertsons",
    name: "Albertsons",
    holds: "Grocery banners across the US. Household and food tools made here can sit on those floors.",
    reachUrl: "https://www.albertsonscompanies.com",
  },
  {
    id: "best-buy",
    name: "Best Buy",
    holds: "US stores for electronics and home goods. Ask for products made in the USA that they can ship.",
    reachUrl: "https://marketplace.bestbuy.com",
  },
  {
    id: "dollar-general",
    name: "Dollar General",
    holds: "Small-town stores across the US. Useful goods made here can reach places a city shop does not.",
    reachUrl: "https://www.dollargeneral.com",
  },
  {
    id: "publix",
    name: "Publix",
    holds: "A large US grocer. The ask is for made-in-USA goods their stores can put in a bag.",
    reachUrl: "https://corporate.publix.com",
  },
  {
    id: "ebay",
    name: "eBay",
    holds: "US sellers who can ship without a long boat, including people making goods here.",
    reachUrl: "https://www.ebay.com/sellercenter",
  },
  {
    id: "wayfair",
    name: "Wayfair",
    holds: "Home stock in US warehouses. Ask them to surface furniture and house goods made in the USA.",
    reachUrl: "https://partners.wayfair.com",
  },
];

export function floorById(id: string) {
  return enterpriseFloors.find((floor) => floor.id === id) ?? null;
}

export function isFloorStatus(value: string): value is FloorStatus {
  return floorStatuses.some((status) => status.id === value);
}

export function reachNote(floor: EnterpriseFloor, storeUrl: string) {
  return [
    `Hello ${floor.name},`,
    "",
    `XVAIsle is a US store at ${storeUrl}. The domain is xvaisle.com. Customers pay there. You keep the inventory and you ship the box. We do not hold stock, and we are not logged into your systems.`,
    "",
    `We want goods made in the USA in front of people who already want them. If you will ship stock you already hold, reply to this note. We will put ${floor.name} on the product page as the floor that ships.`,
    "",
    "This was copied by hand from our desk.",
  ].join("\n");
}

export function xTimelinePost(input: { title: string; price: string; url: string; madeInUsa: boolean }) {
  const made = input.madeInUsa ? " Made in the USA." : "";
  const text = `${input.title}.${made} ${input.price}. Pay on the store.\n${input.url}`;
  return text.length <= 280 ? text : `${text.slice(0, 277)}...`;
}
