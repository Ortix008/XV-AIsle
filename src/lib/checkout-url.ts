function stripeHost(value: string, hosts: string[]) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && hosts.includes(url.hostname);
  } catch {
    return false;
  }
}

export function isStripeCheckoutUrl(value: string) {
  return stripeHost(value, ["checkout.stripe.com"]);
}

export function isStripeRedirectUrl(value: string) {
  return stripeHost(value, ["checkout.stripe.com", "connect.stripe.com"]);
}
