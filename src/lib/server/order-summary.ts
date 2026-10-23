import { etaFromListing, SHOPPER_PLACE, usSupplierConfirmed } from "@/lib/order-facts";
import { RETURNS_EMAILED } from "@/lib/return-address";
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
    shipsFrom: listing && usSupplierConfirmed(listing) ? SHOPPER_PLACE : null,
    eta: etaFromListing(listing),
    returnAddress: listing && usSupplierConfirmed(listing) ? formatOrderReturn(order) : RETURNS_EMAILED,
    productId: order.productId,
  };
}
