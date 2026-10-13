import Link from "next/link";
import { RETURN_WINDOW_DAYS } from "@/lib/policies";

const links = [
  { href: "/shop", label: "Store" },
  { href: "/shop/returns", label: "Returns" },
  { href: "/shop/shipping", label: "Shipping" },
  { href: "/shop/terms", label: "Terms" },
  { href: "/shop/privacy", label: "Privacy" },
  { href: "/shop/reseller", label: "Reseller program" },
  { href: "/shop/contact", label: "Contact" },
  { href: "/shop/safety", label: "How buying works" },
];

export function ShopFooter({ className }: { className?: string }) {
  return (
    <footer
      className={
        className ??
        "mt-auto flex flex-wrap gap-x-5 gap-y-2 border-t px-4 py-8 text-sm text-muted-foreground sm:px-6"
      }
    >
      <span className="text-foreground">XV-AIsle</span>
      {links.map((link) => (
        <Link key={link.href} href={link.href} className="hover:text-foreground">
          {link.label}
        </Link>
      ))}
    </footer>
  );
}

export function CheckoutPolicies() {
  return (
    <p className="text-base text-pretty">
      <Link href="/shop/returns" className="underline underline-offset-4">
        Returns
      </Link>{" "}
      ({RETURN_WINDOW_DAYS} days).{" "}
      <Link href="/shop/shipping" className="underline underline-offset-4">
        Shipping
      </Link>
      .{" "}
      <Link href="/shop/terms" className="underline underline-offset-4">
        Terms
      </Link>
      .{" "}
      <Link href="/shop/privacy" className="underline underline-offset-4">
        Privacy
      </Link>
      .{" "}
      <Link href="/shop/contact" className="underline underline-offset-4">
        Contact
      </Link>
      .
    </p>
  );
}
