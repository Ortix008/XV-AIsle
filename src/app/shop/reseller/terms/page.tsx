import type { Metadata } from "next";
import Link from "next/link";
import { PolicyArticle } from "@/components/policy-article";

export const metadata: Metadata = { title: "Reseller terms · XV-AIsle" };

export default function ResellerTermsPage() {
  return (
    <PolicyArticle kicker="Store" title="Reseller program coming soon.">
      <p>Reseller program coming soon.</p>
      <p>
        We do not promise income. A listing can sell, or it can sell nothing. We do not quote example earnings, and we
        do not say what you will make.
      </p>
      <p>XV can remove a listing that breaks these rules.</p>
      <p>
        The short version is on the{" "}
        <Link href="/shop/reseller" className="underline underline-offset-4">
          reseller program
        </Link>{" "}
        page.
      </p>
    </PolicyArticle>
  );
}
