import { etaFromListing, usSupplierConfirmed } from "@/lib/order-facts";
import { formatOrderReturn } from "./supplier-returns";
import { getListing, type StoreOrder } from "./store";

export type OrderSummary = {
  number: string;
  title: string;
  qty: number;
  amountCents: number;
  shipsFrom: string | null;
  eta: string | null;
  returnAddress: string | null;
  productId: string;
};

export function orderSummary(order: StoreOrder): OrderSummary {
  const listing = getListing(order.productId);
  return {
    number: order.number,
    title: order.title ?? listing?.title ?? "Order",
    qty: order.qty,
    amountCents: order.amountCents,
    shipsFrom: listing && usSupplierConfirmed(listing) ? listing.shipsFrom?.trim() || null : null,
    eta: etaFromListing(listing),
    returnAddress: formatOrderReturn(order),
    productId: order.productId,
  };
}
