import { cookies } from "next/headers";
import Link from "next/link";
import { ReturnsForm } from "@/components/returns-form";
import { ShopFrame } from "@/components/shop-frame";
import { accountFromToken } from "@/lib/server/accounts";
import { SESSION_COOKIE } from "@/lib/server/session-cookie";
import { readReturnsAddress } from "@/lib/server/settings";

export default async function ShopSafetyPage() {
  const returns = readReturnsAddress();
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const account = accountFromToken(token);
  return (
    <ShopFrame>
      <article className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <h1 className="text-3xl font-semibold tracking-tight">How buying works</h1>
        <p className="mt-3 text-base leading-relaxed text-foreground">
          You pick a product, pay on this site, and the supplier ships it to you.
        </p>
        <div className="mt-8 space-y-8">
          <section>
            <h2 className="text-lg font-semibold">Secure payment</h2>
            <p className="mt-2 text-base leading-relaxed text-foreground">
              You pay on xvaisle.com. Stripe handles the card. We never see your card number.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold">Shipping</h2>
            <p className="mt-2 text-base leading-relaxed text-foreground">
              We ship inside the US only. Each product page shows how long shipping takes. The box ships directly from
              the supplier.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold">Returns</h2>
            <p className="mt-2 text-base leading-relaxed text-foreground">
              You can start a return within 30 days of delivery. Contact the seller and include your order number.
              {returns ? (
                <>
                  {" "}
                  Send the box to <span className="font-medium">{returns}</span>.
                </>
              ) : (
                <> The seller will reply with the address for the box.</>
              )}
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold">Your info</h2>
            <p className="mt-2 text-base leading-relaxed text-foreground">
              We use your name, email, and shipping address only to ship the order and send your receipt.{" "}
              <Link href="/shop/privacy" className="underline underline-offset-4">
                Privacy
              </Link>
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold">Questions</h2>
            <p className="mt-2 text-base leading-relaxed text-foreground">
              Something late, missing, or not what you expected? Contact the seller.
            </p>
            <p className="mt-3 text-base">
              <Link href="/shop/contact" className="underline underline-offset-4">
                Contact the seller
              </Link>
            </p>
          </section>
        </div>
        {account?.role === "admin" ? <ReturnsForm initial={returns} /> : null}
      </article>
    </ShopFrame>
  );
}
