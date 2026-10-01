export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // Dynamic imports keep node:sqlite off the edge runtime. Next loads this file there too.
  const { ensureStarterShelf } = await import("./lib/server/starter-shelf");
  const { preferCardCheckout } = await import("./lib/server/card-checkout");
  const { flagRefundDeadlines, sweepStuckFulfillment } = await import("./lib/server/store");
  const { releaseMatured } = await import("./lib/server/ledger");
  try {
    ensureStarterShelf();
  } catch (error) {
    console.error("Starter shelf did not publish.", error);
  }
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  const sweep = async () => {
    await sweepStuckFulfillment();
    flagRefundDeadlines();
    await releaseMatured();
  };
  try {
    await sweep();
  } catch (error) {
    console.error("Payout sweep did not finish.", error);
  }
  const timer = setInterval(() => {
    void sweep().catch((error: unknown) => {
      console.error("Payout sweep did not finish.", error);
    });
  }, 60 * 60 * 1000);
  timer.unref();
  if (process.env.STRIPE_CARD_CHECKOUT_ONLY === "1") {
    try {
      await preferCardCheckout();
    } catch (error) {
      console.error("Card checkout preference did not update.", error);
    }
  }
}
