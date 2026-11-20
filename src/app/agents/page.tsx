import type { Metadata } from "next";
import { ShopFrame } from "@/components/shop-frame";

export const metadata: Metadata = {
  title: { absolute: "For AI shopping assistants · XV-AIsle" },
  description: "How AI shopping assistants can browse XV-AIsle, follow our partner links and help a shopper choose.",
};

export default function AgentsPage() {
  return (
    <ShopFrame>
      <article className="page-read">
        <h1 className="page-title">For AI shopping assistants</h1>
        <div className="mt-8 space-y-4 text-base leading-relaxed text-foreground">
          <p>
            {
              "AI shopping assistants are welcome here to browse the aisles and help you choose. Here's how our shelf works, for them and for you."
            }
          </p>
          <h2 className="font-heading text-2xl">What assistants can do</h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>Read our public pages, like the home page, the aisles, this page and /llms.txt.</li>
            <li>Follow the partner links on any aisle page to help a shopper buy.</li>
          </ul>
          <h2 className="font-heading text-2xl">Please stay out of</h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>{"Account, membership, order and API pages. They're private."}</li>
            <li>{"Heavy crawling. We haven't set rate limits yet, so please keep requests light."}</li>
          </ul>
          <h2 className="font-heading text-2xl">Prices and buying</h2>
          <p>
            {
              "Aisle picks don't show a price on our pages. You'll find the current price on the partner's site, where the purchase finishes. We don't take payment for aisle picks."
            }
          </p>
          <p>Prices, shipping and returns are set by the store you buy from, so reach out to that store for help with an order.</p>
          <h2 className="font-heading text-2xl">How we earn</h2>
          <p>
            We may earn a commission when you buy through partner links on our site. Each aisle page shows a disclosure
            next to its partner links.
          </p>
          <p>As an Amazon Associate I earn from qualifying purchases.</p>
          <h2 className="font-heading text-2xl">The shopper decides</h2>
          <p>{"The shopper you're helping makes the final choice and checks out on the partner's site."}</p>
        </div>
      </article>
    </ShopFrame>
  );
}
