import { productPageUrl } from "@/lib/config/env";
import { buyerShareHref } from "@/lib/x-share";

export function FindShare({ title, productId }: { title: string; productId: string }) {
  const href = buyerShareHref({ title, productUrl: productPageUrl(productId) });
  return (
    <a className="pill pill-ghost" href={href} target="_blank" rel="noreferrer">
      Share your find on X
    </a>
  );
}
