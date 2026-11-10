/** Card line while a shopper cannot buy. The product page keeps its own "Coming soon" label. */
export const SHOP_CARD_STATUS = "Coming soon.";

const PRICE_ON = new Set(["1", "true", "on", "yes"]);

/** Prices stay hidden until SHOW_PRICES is explicitly on. The cents remain in the database. */
export function showShopPrices(value = process.env.SHOW_PRICES) {
  return PRICE_ON.has(value?.trim().toLowerCase() ?? "");
}

/** Shopper payloads drop every price field while prices are hidden. */
export function shopperPriceView<T extends object>(value: T, pricesOn = showShopPrices()) {
  if (pricesOn) return value;
  const hidden = { ...value } as Record<string, unknown>;
  delete hidden.priceCents;
  delete hidden.price;
  return hidden as Omit<T, "priceCents" | "price">;
}

/** Product structured data. Offers are omitted while prices are hidden. */
export function productShopperJsonLd(
  input: { name: string; url: string; priceCents: number },
  pricesOn: boolean,
) {
  const product: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: input.name,
    url: input.url,
  };
  if (!pricesOn) return product;
  product.offers = {
    "@type": "Offer",
    priceCurrency: "USD",
    price: (input.priceCents / 100).toFixed(2),
  };
  return product;
}
