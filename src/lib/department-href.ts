import { liveAisleBySlug } from "@/lib/amazon-aisles";
import { aisleByTitle } from "@/lib/aisles";
import { welcomeDepartments } from "@/lib/art";
import { nightWorldByTitle } from "@/lib/night-worlds";

export type HomeAisleTile = {
  title: string;
  line: string;
  src: string;
  href: string;
};

export const floorDepartments = welcomeDepartments.filter(
  (dept) => ("href" in dept && dept.href) || !nightWorldByTitle(dept.title),
);

export function departmentHref(dept: (typeof floorDepartments)[number]) {
  if ("href" in dept && dept.href) {
    if (dept.href.includes("aisle=bundles")) return "";
    return dept.href;
  }
  const aisle = aisleByTitle(dept.title);
  if (!aisle) return "";
  if (liveAisleBySlug(aisle.slug)) return `/aisles/${aisle.slug}`;
  return `/shop?aisle=${aisle.slug}`;
}
