import Link from "next/link";
import { ShopFrame } from "@/components/shop-frame";

export default function ShopPrivacyPage() {
  return (
    <ShopFrame>
      <article className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <h1 className="text-3xl font-semibold tracking-tight">Privacy</h1>
        <div className="mt-6 space-y-4 text-base leading-relaxed text-foreground">
          <p>
            At checkout we ask for your name, email, and shipping address. We use them to ship the order and send your
            receipt. We do not sell that information.
          </p>
          <p>Stripe processes the card payment. We never see your card number.</p>
          <p>You do not need an account to buy. If you open a seller account, we keep the email and password you chose so you can sign in.</p>
        </div>
        <p className="mt-8 text-base">
          <Link href="/shop/safety" className="underline underline-offset-4">
            How buying works
          </Link>
        </p>
      </article>
    </ShopFrame>
  );
}
