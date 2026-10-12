import type { Product } from "./types";

export type AisleSection = {
  name: string;
};

export type Aisle = {
  title: string;
  slug: string;
  sections: AisleSection[];
};

export const aisles: Aisle[] = [
  {
    title: "Kitchen",
    slug: "kitchen",
    sections: [
      { name: "Pans" },
      { name: "Prep" },
      { name: "Utensils" },
      { name: "Gadgets" },
      { name: "Linens" },
      { name: "Organization" },
    ],
  },
  {
    title: "Clothing",
    slug: "clothing",
    sections: [{ name: "Aprons" }, { name: "Shirts" }],
  },
  {
    title: "Home",
    slug: "home",
    sections: [{ name: "Storage" }, { name: "Light" }, { name: "Cleaning" }, { name: "Cords" }],
  },
  { title: "Sports", slug: "sports", sections: [{ name: "Court" }] },
  {
    title: "Health",
    slug: "health",
    sections: [{ name: "Thermometers" }, { name: "Monitors" }, { name: "Cuffs" }],
  },
  { title: "Seasonal", slug: "seasonal", sections: [{ name: "Carry-home" }] },
  {
    title: "Garden",
    slug: "garden",
    sections: [{ name: "Digging" }, { name: "Cutting" }, { name: "Hands" }],
  },
  {
    title: "Electronics",
    slug: "electronics",
    sections: [{ name: "Audio" }, { name: "Cases" }, { name: "Cables" }],
  },
  {
    title: "Build Your Rig",
    slug: "build-your-rig",
    sections: [{ name: "Components" }, { name: "Power" }],
  },
  {
    title: "Tech & Desk",
    slug: "tech-and-desk",
    sections: [{ name: "Desk" }, { name: "Desk cables" }],
  },
  {
    title: "Home & Gifts",
    slug: "home-and-gifts",
    sections: [{ name: "Gifts" }, { name: "For the house" }],
  },
];

const sectionAisle = new Map<string, string>(
  aisles.flatMap((aisle) => aisle.sections.map((section) => [section.name, aisle.title] as const)),
);

export function aisleByTitle(title: string) {
  return aisles.find((aisle) => aisle.title === title) ?? null;
}

export function aisleBySlug(slug: string) {
  return aisles.find((aisle) => aisle.slug === slug) ?? null;
}

export function placeProduct(product: Product): { aisle: string; section: string } | null {
  if (product.id === "headphones" || product.id === "phone-case") {
    return { aisle: "Build Your Rig", section: "Components" };
  }
  if (product.id === "charger-brick") return { aisle: "Build Your Rig", section: "Power" };
  if (product.id === "desk-lamp") return { aisle: "Tech & Desk", section: "Desk" };
  if (product.id === "cable-sleeve") return { aisle: "Tech & Desk", section: "Desk cables" };
  if (product.id === "gift-bags") return { aisle: "Home & Gifts", section: "Gifts" };
  if (product.id === "storage-jars") return { aisle: "Home & Gifts", section: "For the house" };
  if (product.id === "apron" || product.id === "bib-apron" || /apron/i.test(product.name)) {
    return { aisle: "Clothing", section: "Aprons" };
  }
  if (product.id === "heavy-tee" || product.id === "chambray" || product.category === "Clothes") {
    return { aisle: "Clothing", section: "Shirts" };
  }
  if (product.category === "Safety") return { aisle: "Kitchen", section: "Gadgets" };
  if (product.category === "Sports") return { aisle: "Sports", section: "Court" };
  if (product.category === "Utility") return { aisle: "Home", section: "Cords" };
  if (product.category === "Party extra") return { aisle: "Seasonal", section: "Carry-home" };
  const aisle = sectionAisle.get(product.category);
  if (!aisle) return null;
  return { aisle, section: product.category };
}
