import type { Product } from "./types";

export type AisleSection = {
  name: string;
};

export type Aisle = {
  title: string;
  sections: AisleSection[];
};

export const aisles: Aisle[] = [
  {
    title: "Kitchen",
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
    sections: [{ name: "Aprons" }, { name: "Shirts" }],
  },
  {
    title: "Home",
    sections: [{ name: "Storage" }, { name: "Light" }, { name: "Cleaning" }, { name: "Cords" }],
  },
  { title: "Sports", sections: [{ name: "Court" }] },
  {
    title: "Health",
    sections: [{ name: "Thermometers" }, { name: "Monitors" }, { name: "Cuffs" }],
  },
  { title: "Seasonal", sections: [{ name: "Carry-home" }] },
  {
    title: "Garden",
    sections: [{ name: "Digging" }, { name: "Cutting" }, { name: "Hands" }],
  },
  {
    title: "Electronics",
    sections: [{ name: "Audio" }, { name: "Cases" }, { name: "Cables" }],
  },
];

const sectionAisle = new Map<string, string>(
  aisles.flatMap((aisle) => aisle.sections.map((section) => [section.name, aisle.title] as const)),
);

export function aisleByTitle(title: string) {
  return aisles.find((aisle) => aisle.title === title) ?? null;
}

export function placeProduct(product: Product): { aisle: string; section: string } | null {
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
