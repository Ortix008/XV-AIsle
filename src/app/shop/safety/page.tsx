import { cookies } from "next/headers";
import Link from "next/link";
import { ReturnsForm } from "@/components/returns-form";
import { ShopFrame } from "@/components/shop-frame";
import { STORE_HOST } from "@/lib/domain";
import { accountFromToken } from "@/lib/server/accounts";
import { SESSION_COOKIE } from "@/lib/server/session-cookie";
import { readReturnsAddress } from "@/lib/server/settings";
import { appOrigin } from "@/lib/server/stripe";

export default async function ShopSafetyPage() {
  const origin = appOrigin();
  const returns = readReturnsAddress();
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const account = accountFromToken(token);
  return (
    <ShopFrame>
      <article className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <p className="text-[11px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">Store</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">How an order is handled</h1>
        <div className="mt-6 space-y-4 text-sm leading-relaxed text-pretty text-muted-foreground">
          <p>
            The market name is <span className="font-medium text-foreground">{STORE_HOST}</span>. This copy is posted at{" "}
            <span className="font-medium text-foreground">{origin}/shop</span>. The card is entered on Stripe. XVAIsle
            does not keep the card number. The charge lands on the market’s Stripe account. After the order is
            delivered, Stripe pays the reseller and the supplier. The market keeps 8–12 percent, and Stripe’s card fee
            comes out of that share. The charge lands on the market’s Stripe account. After the order is
            delivered, Stripe pays the reseller and the supplier. The market keeps 8–12 percent, and Stripe’s card fee
            comes out of that share.
          </p>
          <p>
            Shipping is inside the US. The product page says how many days the named shipper takes after payment.
            Quantity on one order is 1 to 5. The name, email, and ship-to address are kept so the box and the receipt
            can find you.
          </p>
          <p>
            A return can be asked for within 30 days of delivery. Write the seller and name the order. The shipper’s
            own return window still applies.
            {returns ? (
              <>
                {" "}
                Send the box to <span className="font-medium text-foreground">{returns}</span>.
              </>
            ) : (
              <> The seller replies with the address for the box.</>
            )}
          </p>
          <p>
            The company named on a product page is the floor the seller says will ship that item. Amazon, Walmart, and
            the other national floors are not logged in here. A name on a page means that seller chose them as the
            shipper.
          </p>
          <p>
            A post on X can open a product page here. Payment, shipping, and returns stay on this store. X does not take
            the card.
          </p>
          <p>
            Sign-in tries and checkout tries are limited. The session cookie is httpOnly. Pictures on the store come
            from this market.
          </p>
        </div>
        <p className="mt-8 text-sm">
          <Link href="/shop/contact" className="underline underline-offset-4">
            Write the seller
          </Link>
        </p>
        {account?.role === "admin" ? <ReturnsForm initial={returns} /> : null}
      </article>
    </ShopFrame>
  );
}
