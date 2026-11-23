import type { Metadata } from "next";
import { ShopFrame } from "@/components/shop-frame";

export const metadata: Metadata = { title: "Privacy · XV-AIsle" };

export default function ShopPrivacyPage() {
  return (
    <ShopFrame>
      <article className="page-read">
        <h1 className="page-title">Privacy</h1>
        <div className="mt-8 space-y-4 text-base leading-relaxed text-foreground">
          <p>{"Here's what XV-AIsle keeps when you browse, sign in or write to us, and what we don't."}</p>
          <h2 className="font-heading text-2xl">Browsing and partner links</h2>
          <p>
            {
              "You can browse every aisle without an account. Picks finish on the partner's site, so you share your details with that store, under its own privacy policy."
            }
          </p>
          <p>
            {
              "When we show a partner link on a page, we note the time, the page, the partner, the pick, and whether a person or an AI shopping assistant is browsing. We don't log your IP address or anything else that says who you are, and we keep only recent entries."
            }
          </p>
          <p>
            {
              "When you click a partner link, that store may place or read cookies in your browser and get information about your visit. That's how it knows we sent you. Its own privacy policy covers what it does with that information."
            }
          </p>
          <h2 className="font-heading text-2xl">Accounts</h2>
          <p>
            If you create an account, we keep your name, your email and your password. Your password is stored
            scrambled, so no one here can read it.
          </p>
          <p>
            {
              "If you sign in with X, we keep only your X user ID and display name. X doesn't share your email with us, so you can add one for receipts."
            }
          </p>
          <p>If you use two-step sign-in, we keep its code key encrypted.</p>
          <h2 className="font-heading text-2xl">Cookies</h2>
          <p>
            {
              "We use a few cookies to keep you signed in, to keep sign-in safe, and to remember for 30 days if a reseller's link brought you here. We don't use ad or analytics cookies, and there are no tracking pixels."
            }
          </p>
          <h2 className="font-heading text-2xl">Emails</h2>
          <p>
            We email you about your account only, like confirming your address, sending a reset link, or telling you
            when your password changes or someone tries to sign up with your email.
          </p>
          <h2 className="font-heading text-2xl">Writing to us</h2>
          <p>If you use our contact form or join a waitlist, we keep what you send, like your name, email and message, so we can reply.</p>
          <h2 className="font-heading text-2xl">Keeping the site safe</h2>
          <p>To stop abuse, we keep the IP address of sign-in and form tries for about 15 minutes.</p>
          <h2 className="font-heading text-2xl">Past orders and payments</h2>
          <p>
            If you placed an order with us before, we keep its name, email and shipping address to handle that order.
            Stripe took the payment on its own page, so we never saw your card number.
          </p>
          <p>{"We don't sell your information."}</p>
          <h2 className="font-heading text-2xl">Your choices</h2>
          <p>To have your account or your data deleted, email us at xvaisle.team@gmail.com.</p>
          <p>You can reach us at xvaisle.team@gmail.com, and we reply within 2 business days.</p>
        </div>
      </article>
    </ShopFrame>
  );
}
