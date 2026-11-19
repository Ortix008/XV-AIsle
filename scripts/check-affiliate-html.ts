import { spawn } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const viatorUrl = "https://www.viator.com/?pid=P00330828&mcid=42383&medium=link";
const guideUrl = "https://www.getyourguide.com/?partner_id=YEH3QKQ";
const zazzleUrl = "https://www.zazzle.com/?rf=238672294015858667";
const disclosure = "We may earn a commission when you buy through these links.";
const port = 4331;
const base = `http://127.0.0.1:${port}`;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function walk(dir: string, hit: (file: string, text: string) => void) {
  for (const name of readdirSync(dir)) {
    if (name === "cache" || name === "node_modules") continue;
    const path = join(dir, name);
    const info = statSync(path);
    if (info.isDirectory()) {
      walk(path, hit);
      continue;
    }
    if (info.size > 2_000_000) continue;
    if (!/\.(html|js|json|rsc|txt|css)$/.test(name)) continue;
    const text = readFileSync(path, "utf8");
    if (text.includes("[WORDY")) hit(path, text);
  }
}

async function waitForServer() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(base + "/");
      if (response.ok) return;
    } catch {
      // The server is still booting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("the production server did not start");
}

async function main() {
  const hits: string[] = [];
  walk(join(process.cwd(), ".next"), (file) => hits.push(file));
  assert(hits.length === 0, `[WORDY remains in the build: ${hits.slice(0, 5).join(", ")}`);

  const db = join(mkdtempSync(join(tmpdir(), "xvaisle-html-")), "shop.sqlite");
  const child = spawn("npm", ["run", "start"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(port),
      DATABASE_PATH: db,
      APP_URL: base,
      SUPPORT_EMAIL: "support@example.com",
      NEXT_TELEMETRY_DISABLED: "1",
    },
    stdio: "ignore",
  });
  try {
    await waitForServer();
    const home = await fetch(base + "/", { redirect: "manual" });
    const homeBody = await home.text();
    assert(home.status === 200, `home returned ${home.status}`);
    for (const word of [
      "Viator",
      "GetYourGuide",
      "Zazzle",
      "Bookshop",
      "[WORDY",
      viatorUrl,
      zazzleUrl,
      "sent straight to your door",
      "Local business",
      "packs the order",
      "Big companies",
      "curated US market",
      "every cook",
      "Your share",
      "release a payout",
      "Reseller program coming soon",
    ]) {
      assert(!homeBody.includes(word), `home HTML/RSC includes ${word}`);
    }
    const gifts = await fetch(base + "/shop?aisle=home-and-gifts", { redirect: "manual" });
    const giftsBody = await gifts.text();
    assert(gifts.status === 200, `Home & Gifts returned ${gifts.status}`);
    assert(giftsBody.includes(zazzleUrl.replaceAll("&", "&amp;")), "Home & Gifts HTML renders the Zazzle URL");
    assert(giftsBody.includes('rel="sponsored noopener noreferrer"'), "Home & Gifts partner links are sponsored");
    assert(giftsBody.includes(disclosure), "Home & Gifts shows the short disclosure");
    assert(!giftsBody.includes("bookshop.org") && !giftsBody.includes("[WORDY"), "Home & Gifts omits the unset Bookshop link");
    const tickets = await fetch(base + "/aisles/tickets-and-events", { redirect: "manual" });
    const ticketsBody = await tickets.text();
    assert(tickets.status === 200, `Tickets & Events returned ${tickets.status}`);
    assert(ticketsBody.includes(viatorUrl.replaceAll("&", "&amp;")), "Tickets HTML renders the Viator URL");
    assert(ticketsBody.includes(guideUrl), "Tickets HTML renders the GetYourGuide URL");
    assert(ticketsBody.includes('rel="sponsored noopener noreferrer"'), "Tickets partner links are sponsored");
    assert(ticketsBody.includes(disclosure) && !ticketsBody.includes("[WORDY"), "Tickets shows the short disclosure");
  } finally {
    child.kill("SIGTERM");
  }
  console.log("affiliate html checks ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
