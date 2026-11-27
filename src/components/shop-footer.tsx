"use client";

import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { MissionValues } from "@/components/mission-values";
import { useOptionalAccount } from "@/lib/account-store";
import { AMAZON_ASSOCIATE_DISCLOSURE } from "@/lib/amazon-aisles";
import { giftSpotsHaveLinks } from "@/config/affiliates";
import { OPERATOR_ABOUT } from "@/config/operator-about";
import { RETURN_WINDOW_DAYS } from "@/lib/policies";

const RESELLER_LINKS = new Set(["/shop/reseller", "/shop/reseller/terms"]);

const columns = [
  {
    title: "Shop",
    links: [
      { href: "/shop", label: "Shop" },
      { href: "/shop/small", label: "Small business" },
    ],
  },
  {
    title: "Help",
    links: [
      { href: "/shop/shipping", label: "Shipping" },
      { href: "/shop/returns", label: "Returns" },
      { href: "/shop/contact", label: "Contact" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/shop/reseller/terms", label: "Reseller terms" },
      { href: "/shop/privacy", label: "Privacy" },
      { href: "/shop/terms", label: "Terms" },
      { href: "/agents", label: "For AI shopping assistants" },
    ],
  },
];

export function ShopFooter({
  showReseller,
  showStorePayLine = false,
  showBrandBlock = false,
  showAmazonDisclosure = false,
  about = OPERATOR_ABOUT,
}: {
  showReseller?: boolean;
  showStorePayLine?: boolean;
  showBrandBlock?: boolean;
  showAmazonDisclosure?: boolean;
  about?: string;
}) {
  const session = useOptionalAccount();
  const account = session?.account;
  const signedInOperator = account?.role === "admin" && account.emailVerified === true;
  const operator = showReseller ?? signedInOperator;
  const shown = columns.map((column) => ({
    ...column,
    links: [
      ...(operator ? column.links : column.links.filter((link) => !RESELLER_LINKS.has(link.href))),
      ...(column.title === "Shop" && giftSpotsHaveLinks()
        ? [{ href: "/shop?aisle=home-and-gifts", label: "Home & Gifts" }]
        : []),
    ],
  }));
  return (
    <footer className="shop-footer mt-auto bg-[var(--footer)] pb-9">
      {showBrandBlock ? <MissionValues /> : null}
      <div className={`mx-auto max-w-[1280px] px-5 sm:px-10 ${showBrandBlock ? "pt-16" : "pt-8"}`}>
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr]">
          <div>
            <Link href="/" className="footer-mark">
              <BrandMark />
            </Link>
            <p className="mt-4 max-w-xs text-sm text-muted-foreground">
              No fake discounts, countdown timers, spin wheels, or made-up stock counts.
            </p>
          </div>
          {shown.map((column) => (
            <div key={column.title}>
              <h2 className="font-heading text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                {column.title}
              </h2>
              <ul className="link-row footer-links">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="tap-link link-slide text-sm text-[var(--link)] hover:text-foreground">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-14 flex flex-col gap-3 border-t border-border pt-6 text-[13px] text-muted-foreground">
          {about.trim() ? (
            <p className="footer-about">
              <span className="brand-keep">{about}</span>
            </p>
          ) : null}
          <p className="footer-about">
            Opportunity shouldn&apos;t depend on where you start. <span className="brand-keep">XV-AIsle</span> is building the aisle to prove it.
          </p>
          {showAmazonDisclosure ? <p>{AMAZON_ASSOCIATE_DISCLOSURE}</p> : null}
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
            <span>© {new Date().getFullYear()} <span className="brand-keep">XV-AIsle</span></span>
            {showStorePayLine ? <span>Buyers pay on xvaisle.com</span> : null}
          </div>
        </div>
      </div>
    </footer>
  );
}

export function CheckoutPolicies() {
  return (
    <div className="link-row policy-links">
      <Link href="/shop/returns" className="tap-link text-[var(--link)] underline underline-offset-4 hover:text-foreground">
        Returns
      </Link>
      <span>({RETURN_WINDOW_DAYS} days).</span>
      <Link href="/shop/shipping" className="tap-link text-[var(--link)] underline underline-offset-4 hover:text-foreground">
        Shipping
      </Link>
      <Link href="/shop/terms" className="tap-link text-[var(--link)] underline underline-offset-4 hover:text-foreground">
        Terms
      </Link>
      <Link href="/shop/privacy" className="tap-link text-[var(--link)] underline underline-offset-4 hover:text-foreground">
        Privacy
      </Link>
      <Link href="/shop/contact" className="tap-link text-[var(--link)] underline underline-offset-4 hover:text-foreground">
        Contact
      </Link>
    </div>
  );
}
