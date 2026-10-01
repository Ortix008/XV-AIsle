function secret() {
  const value = process.env.STRIPE_SECRET_KEY;
  return value?.trim() ? value.trim() : null;
}

type PaymentConfig = {
  id: string;
  is_default?: boolean;
  link?: { display_preference?: { preference?: string } };
  us_bank_account?: { display_preference?: { preference?: string } };
};

/**
 * Turn off Link and US bank on the default Stripe payment configuration.
 * Opt-in only: this mutates the platform Stripe account, so it runs when STRIPE_CARD_CHECKOUT_ONLY=1.
 */
export async function preferCardCheckout() {
  const key = secret();
  if (!key) return { ok: false as const, reason: "Stripe is not configured." };
  const list = await fetch("https://api.stripe.com/v1/payment_method_configurations?limit=10", {
    headers: { Authorization: `Bearer ${key}` },
  });
  const payload = (await list.json()) as { data?: PaymentConfig[]; error?: { message?: string } };
  if (!list.ok) return { ok: false as const, reason: payload.error?.message ?? "Stripe did not list payment methods." };
  const config = payload.data?.find((item) => item.is_default) ?? payload.data?.[0];
  if (!config) return { ok: false as const, reason: "Stripe has no payment method configuration." };
  const linkOff = config.link?.display_preference?.preference === "off";
  const bankOff = config.us_bank_account?.display_preference?.preference === "off";
  if (linkOff && bankOff) return { ok: true as const, changed: false };
  const body = new URLSearchParams();
  body.set("link[display_preference][preference]", "off");
  body.set("us_bank_account[display_preference][preference]", "off");
  const update = await fetch(`https://api.stripe.com/v1/payment_method_configurations/${encodeURIComponent(config.id)}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const updated = (await update.json()) as { error?: { message?: string } };
  if (!update.ok) return { ok: false as const, reason: updated.error?.message ?? "Stripe did not update payment methods." };
  return { ok: true as const, changed: true };
}
