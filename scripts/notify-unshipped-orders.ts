/**
 * One delay email for each paid order still unshipped after 7 business days.
 * The store process also runs this every hour. SMTP unset logs the message and does not send it.
 */
async function main() {
  const { notifyUnshippedDelays } = await import("../src/lib/server/order-routing");
  const result = await notifyUnshippedDelays();
  console.log(`Unshipped delay notices: ${result.noticed}`);
}

void main();
