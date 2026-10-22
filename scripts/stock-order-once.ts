import { createPendingOrder } from "../src/lib/server/store";

const qty = Number(process.env.STOCK_QTY);
const result = createPendingOrder({
  productId: process.env.STOCK_PRODUCT ?? "",
  qty,
  sku: process.env.STOCK_SKU || undefined,
  ship: {
    name: "Example Buyer",
    email: "buyer@example.com",
    line1: "100 Example Street",
    city: "Sample City",
    region: "ST",
    postal: "00000",
    country: "US",
  },
});

console.log(JSON.stringify({ ok: !("error" in result), error: "error" in result ? result.error : null }));
