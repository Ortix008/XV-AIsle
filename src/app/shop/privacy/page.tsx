import type { Metadata } from "next";
import Link from "next/link";
import { PolicyArticle } from "@/components/policy-article";
import { viewerIsOperator } from "@/lib/server/require-operator";

export const metadata: Metadata = { title: "Privacy · XV-AIsle" };

export default async function ShopPrivacyPage() {
  const operator = await viewerIsOperator();
  return (
    <PolicyArticle kicker="Store" title="Privacy" operator={operator}>
      <p>
        At checkout we ask for your name, email, and shipping address. We use them to ship the order and send your
        receipt. We do not sell that information.
      </p>
      <p>Stripe processes the card payment. We never see your card number.</p>
      <p>
        You do not need an account to buy. If you open a seller account, we keep the email and password you chose so
        you can sign in.
      </p>
      <p>
        You can reach us at xvaisle.team@gmail.com, and we reply within 2 business days. Returns go back to the
        supplier{operator ? ", and we'll email the return address when you start a return" : ""}.
      </p>
      <p>
        <Link href="/shop/returns" className="underline underline-offset-4">
          Returns
        </Link>
        {" · "}
        <Link href="/shop/shipping" className="underline underline-offset-4">
          Shipping
        </Link>
        {" · "}
        <Link href="/shop/terms" className="underline underline-offset-4">
          Terms
        </Link>
      </p>
    </PolicyArticle>
  );
}
