import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { RETURN_WINDOW_DAYS } from "@/lib/policies";

const columns = [
  {
    title: "Shop",
    links: [
      { href: "/shop", label: "Shop" },
      { href: "/shop/usa", label: "Made in the USA" },
      { href: "/shop/small", label: "Small business" },
    ],
  },
  {
    title: "Help",
    links: [
      { href: "/shop/shipping", label: "Shipping" },
      { href: "/shop/returns", label: "Returns" },
      { href: "/shop/contact", label: "Contact" },
      { href: "/shop/safety", label: "How buying works" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/shop/reseller", label: "Reseller program" },
      { href: "/shop/privacy", label: "Privacy" },
      { href: "/shop/terms", label: "Terms" },
    ],
  },
];

export function ShopFooter() {
  return (
    <footer className="mt-auto border-t border-border bg-[var(--footer)] pt-20 pb-9">
      <div className="mx-auto max-w-[1280px] px-5 sm:px-10">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr]">
          <div>
            <Link href="/" className="inline-flex">
              <BrandMark />
            </Link>
            <p className="mt-4 max-w-xs text-sm text-muted-foreground">A curated aisle for goods that earn their place.</p>
          </div>
          {columns.map((column) => (
            <div key={column.title}>
              <h2 className="font-heading text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                {column.title}
              </h2>
              <ul className="mt-4 space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="link-slide text-sm text-[var(--link)] hover:text-foreground">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-14 flex flex-col gap-2 border-t border-border pt-6 text-[13px] text-muted-foreground sm:flex-row sm:justify-between">
          <span>© {new Date().getFullYear()} XV-AIsle</span>
          <span>Buyers pay on xvaisle.com</span>
        </div>
      </div>
    </footer>
  );
}

export function CheckoutPolicies() {
  return (
    <p className="text-base text-pretty text-muted-foreground">
      <Link href="/shop/returns" className="text-[var(--link)] underline underline-offset-4 hover:text-foreground">
        Returns
      </Link>{" "}
      ({RETURN_WINDOW_DAYS} days).{" "}
      <Link href="/shop/shipping" className="text-[var(--link)] underline underline-offset-4 hover:text-foreground">
        Shipping
      </Link>
      .{" "}
      <Link href="/shop/terms" className="text-[var(--link)] underline underline-offset-4 hover:text-foreground">
        Terms
      </Link>
      .{" "}
      <Link href="/shop/privacy" className="text-[var(--link)] underline underline-offset-4 hover:text-foreground">
        Privacy
      </Link>
      .{" "}
      <Link href="/shop/contact" className="text-[var(--link)] underline underline-offset-4 hover:text-foreground">
        Contact
      </Link>
      .
    </p>
  );
}
