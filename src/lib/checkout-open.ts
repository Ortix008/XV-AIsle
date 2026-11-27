/** Approved home checkout lines. The Stripe test-mode flag picks one. */
export const CHECKOUT_OPEN_TEST =
  "Beta: we're still testing checkout, so no real payments are taken.";

export const CHECKOUT_OPEN_LIVE = "Checkout is open. Your payment is processed securely.";

export function checkoutOpenLine(testMode: boolean) {
  return testMode ? CHECKOUT_OPEN_TEST : CHECKOUT_OPEN_LIVE;
}
