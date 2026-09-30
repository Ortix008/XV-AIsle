import type { Lane, Product, SupplierQuote } from "./types";

type StockInput = {
  id: string;
  sku: string;
  name: string;
  titleLead: string;
  category: string;
  lane: Lane;
  ceiling: number;
  unitCost: number;
  src: string;
  material: string;
  size: string;
  hook: string;
};

function suppliers(id: string, unitCost: number): SupplierQuote[] {
  return [
    {
      id: `${id}:northwharf`,
      name: "Northwharf Goods",
      origin: "Elizabeth, NJ",
      speed: "us",
      unitCost,
      inboundShipping: 0,
      packaging: 0.9,
      shipDaysMin: 2,
      shipDaysMax: 4,
      rating: 4.7,
      reviews: 180,
      moq: 1,
      returnWindowDays: 30,
      note: "In the NJ warehouse. Ships after the order.",
    },
    {
      id: `${id}:harborkit`,
      name: "Harborkit",
      origin: "Los Angeles, CA",
      speed: "us",
      unitCost: Math.round((unitCost + 1.6) * 100) / 100,
      inboundShipping: 0.8,
      packaging: 0.9,
      shipDaysMin: 3,
      shipDaysMax: 5,
      rating: 4.6,
      reviews: 90,
      moq: 1,
      returnWindowDays: 30,
      note: "Same article on the West Coast, if NJ runs thin.",
    },
    {
      id: `${id}:paperlane`,
      name: "Paperlane Direct",
      origin: "Yiwu, China",
      speed: "import",
      unitCost: Math.round(unitCost * 0.55 * 100) / 100,
      inboundShipping: 3.8,
      packaging: 0.6,
      shipDaysMin: 16,
      shipDaysMax: 24,
      rating: 4.4,
      reviews: 420,
      moq: 6,
      returnWindowDays: 7,
      note: "Lower unit cost. Three weeks on a boat.",
    },
  ];
}

function article(input: StockInput): Product {
  return {
    id: input.id,
    sku: input.sku,
    name: input.name,
    titleLead: input.titleLead,
    category: input.category,
    lane: input.lane,
    occasion: "a restock on the floor",
    material: input.material,
    size: input.size,
    colorway: "As shown",
    swatch: "#d5d8dd",
    ceiling: input.ceiling,
    neededInDays: 12,
    box: `One ${input.titleLead.toLowerCase()}.`,
    useLine: input.hook,
    colorNote: "The photo is the color. Do not promise a shade the picture does not show.",
    hook: input.hook,
    searchPhrase: input.titleLead.toLowerCase(),
    keywords: input.titleLead.toLowerCase().split(/\s+/),
    complements: "the other articles already in this section",
    trend: {
      platform: "X",
      title: input.titleLead,
      signal: "The section keeps selling this kind of article, so the floor holds more than one.",
      evidence: "US stock is on hand. Rotate it forward when the one on the floor has had its turn.",
    },
    mockups: [
      {
        title: "On the table",
        direction: "The article alone, in daylight. No extra props.",
        layout: "stack",
        src: input.src,
      },
    ],
    suppliers: suppliers(input.id, input.unitCost),
  };
}

const rows: StockInput[] = [
  { id: "half-sheet", sku: "LN-PAN-H", name: "Half sheet pan", titleLead: "Half sheet pan", category: "Pans", lane: "kitchen", ceiling: 32, unitCost: 9.5, src: "/art/aisle-half-sheet.png", material: "Aluminum", size: "13 × 18 in", hook: "A wider pan for the nights the quarter sheet is already in the sink." },
  { id: "cutting-board", sku: "LN-BRD-1", name: "Maple cutting board", titleLead: "Maple cutting board", category: "Prep", lane: "kitchen", ceiling: 42, unitCost: 14, src: "/art/aisle-board.png", material: "Maple", size: "12 × 16 in", hook: "A board that stays on the counter. No food comes with it." },
  { id: "oven-mitt", sku: "LN-MIT-1", name: "Quilted oven mitt", titleLead: "Quilted oven mitt", category: "Linens", lane: "kitchen", ceiling: 22, unitCost: 6.5, src: "/art/aisle-mitt.png", material: "Quilted cotton", size: "One size", hook: "The hand that pulls the pan. Sold as a mitt, not as a meal." },
  { id: "drawer-tray", sku: "LN-TRY-1", name: "Drawer organizer", titleLead: "Drawer organizer", category: "Organization", lane: "kitchen", ceiling: 28, unitCost: 8, src: "/art/aisle-tray.png", material: "Wood", size: "6 compartments", hook: "Empty compartments. The owner decides what goes in them." },
  { id: "bib-apron", sku: "AP-BIB-1", name: "Denim bib apron", titleLead: "Denim bib apron", category: "Aprons", lane: "apparel", ceiling: 48, unitCost: 16, src: "/art/aisle-bib.png", material: "Denim", size: "One size", hook: "A bib apron for the person who already has the waist tie." },
  { id: "chambray", sku: "AP-SHT-2", name: "Chambray work shirt", titleLead: "Chambray work shirt", category: "Shirts", lane: "apparel", ceiling: 54, unitCost: 18, src: "/art/aisle-chambray.png", material: "Chambray", size: "S–XL", hook: "A folded work shirt. The size run ships from US stock." },
  { id: "storage-jars", sku: "HM-JAR-2", name: "Glass storage jars, pair", titleLead: "Glass storage jars", category: "Storage", lane: "utility", ceiling: 26, unitCost: 7.5, src: "/art/aisle-jars.png", material: "Glass, gray lids", size: "Pair", hook: "Empty jars for the shelf. Nothing edible is in the box." },
  { id: "desk-lamp", sku: "HM-LMP-2", name: "Desk lamp", titleLead: "Desk lamp", category: "Light", lane: "utility", ceiling: 46, unitCost: 15, src: "/art/aisle-desklamp.png", material: "Metal", size: "14 in", hook: "A small lamp for the desk, next to the floor lamp already in the section." },
  { id: "dustpan", sku: "HM-DST-1", name: "Dustpan", titleLead: "Dustpan", category: "Cleaning", lane: "utility", ceiling: 18, unitCost: 5, src: "/art/aisle-dustpan.png", material: "Plastic", size: "One", hook: "The pan that meets the broom. Cleaning tools, not a kit of cleaners." },
  { id: "cable-sleeve", sku: "HM-SLV-1", name: "Cable sleeve", titleLead: "Cable sleeve", category: "Cords", lane: "utility", ceiling: 16, unitCost: 4.2, src: "/art/aisle-sleeve.png", material: "Fabric", size: "5 ft", hook: "A sleeve for the cords already on the desk." },
  { id: "jump-rope", sku: "SP-ROP-1", name: "Speed jump rope", titleLead: "Speed jump rope", category: "Court", lane: "sport", ceiling: 24, unitCost: 7, src: "/art/aisle-rope.png", material: "Cable, wood handles", size: "Adjustable", hook: "A rope for the same hour as the court towel." },
  { id: "forehead-thermo", sku: "HL-THM-2", name: "Forehead thermometer", titleLead: "Forehead thermometer", category: "Thermometers", lane: "utility", ceiling: 36, unitCost: 11, src: "/art/aisle-forehead.png", material: "Plastic", size: "No-touch", hook: "A gadget for temperature. Not medicine, and nothing to swallow." },
  { id: "bath-scale", sku: "HL-SCL-1", name: "Digital scale", titleLead: "Digital scale", category: "Monitors", lane: "utility", ceiling: 32, unitCost: 10, src: "/art/aisle-scale.png", material: "Plastic", size: "Floor", hook: "A scale that shows a number. No program and no pills." },
  { id: "heat-pad", sku: "HL-PAD-1", name: "Heating pad", titleLead: "Heating pad", category: "Cuffs", lane: "utility", ceiling: 34, unitCost: 12, src: "/art/aisle-heatpad.png", material: "Fabric", size: "12 × 15 in", hook: "A pad that warms. It is a tool, not a treatment." },
  { id: "gift-bags", sku: "SN-BAG-6", name: "Kraft gift bags, 6", titleLead: "Kraft gift bags", category: "Carry-home", lane: "party-extra", ceiling: 18, unitCost: 4.5, src: "/art/aisle-bags.png", material: "Kraft paper", size: "6 bags", hook: "Plain bags for what the guest carries home. No print on them." },
  { id: "garden-snips", sku: "GD-SNP-1", name: "Garden snips", titleLead: "Garden snips", category: "Cutting", lane: "utility", ceiling: 22, unitCost: 7, src: "/art/aisle-snips.png", material: "Steel, black handles", size: "6 in", hook: "A smaller cutter next to the pruners. No plants in the box." },
  { id: "knee-pad", sku: "GD-KNE-1", name: "Kneeling pad", titleLead: "Kneeling pad", category: "Hands", lane: "utility", ceiling: 20, unitCost: 6, src: "/art/aisle-kneepad.png", material: "Foam", size: "One", hook: "A pad for the knees while the gloves stay on the hands." },
  { id: "headphones", sku: "EL-HPH-1", name: "Over-ear headphones", titleLead: "Over-ear headphones", category: "Audio", lane: "utility", ceiling: 58, unitCost: 22, src: "/art/aisle-headphones.png", material: "Matte plastic", size: "One", hook: "Headphones for the desk, beside the speaker." },
  { id: "phone-case", sku: "EL-CSE-2", name: "Phone case", titleLead: "Phone case", category: "Cases", lane: "utility", ceiling: 22, unitCost: 5.5, src: "/art/aisle-case.png", material: "Matte plastic", size: "Unprinted", hook: "An empty case. No logo on it." },
  { id: "charger-brick", sku: "EL-CHG-1", name: "USB-C charger", titleLead: "USB-C charger", category: "Cables", lane: "utility", ceiling: 24, unitCost: 7, src: "/art/aisle-charger.png", material: "Plastic", size: "One brick", hook: "The brick that meets the cable already in the section." },
];

export const stocked: Product[] = rows.map(article);

export function addedProduct(input: {
  id: string;
  name: string;
  category: string;
  lane: Lane;
}): Product {
  return article({
    id: input.id,
    sku: input.id.toUpperCase(),
    name: input.name,
    titleLead: input.name,
    category: input.category,
    lane: input.lane,
    ceiling: 36,
    unitCost: 9,
    src: "",
    material: "To confirm",
    size: "To confirm",
    hook: `${input.name} was added to ${input.category}. Confirm the picture before the page goes out.`,
  });
}
