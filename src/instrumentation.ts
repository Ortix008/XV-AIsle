export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { ensureStarterShelf } = await import("./lib/server/starter-shelf");
  const { preferCardCheckout } = await import("./lib/server/card-checkout");
  try {
    ensureStarterShelf();
  } catch (error) {
    console.error("Starter shelf did not publish.", error);
  }
  if (process.env.STRIPE_CARD_CHECKOUT_ONLY === "1") {
    try {
      await preferCardCheckout();
    } catch (error) {
      console.error("Card checkout preference did not update.", error);
    }
  }
}
