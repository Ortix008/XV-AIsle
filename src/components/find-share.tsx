import { productPageUrl } from "@/lib/config/env";
import { SHARE_LABEL } from "@/lib/share-label";
import { buyerShareHref } from "@/lib/x-share";

export function FindShare({ title, productId }: { title: string; productId: string }) {
  const href = buyerShareHref({ title, productUrl: productPageUrl(productId) });
  return (
    <a className="pill pill-ghost" href={href} target="_blank" rel="noreferrer">
      {SHARE_LABEL}
    </a>
  );
}
