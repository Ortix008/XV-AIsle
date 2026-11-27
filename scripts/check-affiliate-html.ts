import { spawn, type ChildProcess } from "node:child_process";
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

function decode(html: string) {
  return html.replaceAll("&#x27;", "'").replaceAll("&apos;", "'").replaceAll("&amp;", "&");
}

function assertNoPlatformBrands(html: string) {
  const body = html.includes("<body") ? html.slice(html.indexOf("<body")) : html;
  const text = decode(body.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, " "));
  const brands = [
    "chatgpt",
    "openai",
    "claude",
    "anthropic",
    "perplexity",
    "gemini",
    "copilot",
    "grok",
    "google",
    "bing",
    "apple",
    "microsoft",
    "facebook",
    "instagram",
    "viator",
    "getyourguide",
    "zazzle",
    "bookshop",
    "awin",
    "impact",
  ];
  for (const brand of brands) {
    assert(!new RegExp(`\\b${brand}\\b`, "i").test(text), `/agents names ${brand}`);
  }
  const sentence = "As an Amazon Associate I earn from qualifying purchases.";
  assert(text.includes(sentence), "the Associates sentence is on /agents");
  assert(!/amazon/i.test(text.split(sentence).join("")), "Amazon appears only in the Associates sentence");
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

function stopServer(child: ChildProcess) {
  const pid = child.pid;
  if (!pid || child.exitCode !== null || child.signalCode) return;
  try {
    process.kill(-pid, "SIGTERM");
  } catch {
    try {
      child.kill("SIGTERM");
    } catch {
      // The server is already gone.
    }
  }
}

function stopServerAndWait(child: ChildProcess) {
  if (child.exitCode !== null || child.signalCode) return Promise.resolve();
  stopServer(child);
  if (child.exitCode !== null || child.signalCode) return Promise.resolve();
  return new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      const pid = child.pid;
      if (pid) {
        try {
          process.kill(-pid, "SIGKILL");
        } catch {
          try {
            child.kill("SIGKILL");
          } catch {
            // The server is already gone.
          }
        }
      }
      resolve();
    }, 3000);
    child.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

async function main() {
  const hits: string[] = [];
  walk(join(process.cwd(), ".next"), (file) => hits.push(file));
  assert(hits.length === 0, `[WORDY remains in the build: ${hits.slice(0, 5).join(", ")}`);

  const db = join(mkdtempSync(join(tmpdir(), "xvaisle-html-")), "shop.sqlite");
  const child = spawn("npm", ["run", "start"], {
    cwd: process.cwd(),
    detached: true,
    env: {
      ...process.env,
      PORT: String(port),
      DATABASE_PATH: db,
      APP_URL: base,
      SUPPORT_EMAIL: "support@example.com",
      NEXT_TELEMETRY_DISABLED: "1",
      STRIPE_SECRET_KEY: ["sk", "test", "htmlcheck"].join("_"),
    },
    stdio: "ignore",
  });
  const onSignal = (signal: NodeJS.Signals) => {
    void stopServerAndWait(child).finally(() => {
      process.exit(signal === "SIGINT" ? 130 : 143);
    });
  };
  process.once("SIGINT", onSignal);
  process.once("SIGTERM", onSignal);
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
    assert(!giftsBody.includes(zazzleUrl.replaceAll("&", "&amp;")), "Home & Gifts no longer renders the Zazzle shop URL");
    assert(!giftsBody.includes("175607631410889940") && !giftsBody.includes("168710004482190645") && !giftsBody.includes("256136298078136813"), "Home & Gifts no longer renders the Zazzle product cards");
    assert(!giftsBody.includes("Gift ideas"), "Home & Gifts no longer shows the Gift ideas spot");
    assert(giftsBody.includes('rel="sponsored noopener noreferrer"'), "Home & Gifts partner links are sponsored");
    assert(giftsBody.includes(disclosure), "Home & Gifts shows the short disclosure");
    assert(giftsBody.includes("https://bookshop.org/a/131173/9781476753836"), "Home &amp; Gifts renders Salt, Fat, Acid, Heat");
    assert(giftsBody.includes("https://bookshop.org/a/131173/9781607749165"), "Home &amp; Gifts renders Ottolenghi Simple");
    assert(giftsBody.includes("https://bookshop.org/a/131173/9780735211292"), "Home &amp; Gifts renders Atomic Habits");
    assert(giftsBody.includes("https://bookshop.org/a/131173/9780358414230"), "Home &amp; Gifts renders Dog Is Love");
    assert(!giftsBody.includes("[WORDY"), "Home & Gifts has no pending copy marker");
    const tickets = await fetch(base + "/aisles/tickets-and-events", { redirect: "manual" });
    const ticketsBody = await tickets.text();
    assert(tickets.status === 200, `Tickets & Events returned ${tickets.status}`);
    assert(ticketsBody.includes(viatorUrl.replaceAll("&", "&amp;")), "Tickets HTML renders the Viator URL");
    assert(ticketsBody.includes(guideUrl), "Tickets HTML renders the GetYourGuide URL");
    assert(
      ticketsBody.includes(
        "https://www.getyourguide.com/orlando-l191/kennedy-space-center-tour-t11881/?partner_id=YEH3QKQ&mkt_cmp=true".replaceAll("&", "&amp;"),
      ),
      "Tickets HTML renders the Kennedy Space Center tour",
    );
    assert(
      !ticketsBody.includes(
        "https://www.getyourguide.com/orlando-l191/orlando-everglades-airboat-ride-and-wildlife-park-ticket-t20590/?partner_id=YEH3QKQ",
      ),
      "Tickets HTML no longer uses the GetYourGuide Everglades URL",
    );
    assert(
      ticketsBody.includes("5467OHEP") && ticketsBody.includes("pid=P00330828"),
      "Tickets HTML renders the Everglades tour on Viator",
    );
    assert(ticketsBody.includes("173028P2") && ticketsBody.includes("179637P1"), "Tickets HTML renders the new Viator tours");
    assert(ticketsBody.includes('rel="sponsored noopener noreferrer"'), "Tickets partner links are sponsored");
    assert(ticketsBody.includes(disclosure) && !ticketsBody.includes("[WORDY"), "Tickets shows the short disclosure");
    assert(ticketsBody.includes("Tours and things to do for days out with family and friends."), "Tickets HTML uses the approved blurb");
    assert(!ticketsBody.includes("Tickets and events for nights out with family and friends."), "Tickets HTML drops the old blurb");

    const holiday = await fetch(base + "/aisles/holiday", { redirect: "manual" });
    const holidayBody = await holiday.text();
    assert(holiday.status === 200, `Holiday returned ${holiday.status}`);
    assert(holidayBody.includes(zazzleUrl.replaceAll("&", "&amp;")), "Holiday HTML renders the Zazzle shop URL");
    assert(holidayBody.includes("175607631410889940") && holidayBody.includes("168710004482190645") && holidayBody.includes("256136298078136813"), "Holiday HTML renders the three Zazzle product cards");
    assert(holidayBody.includes("Gift ideas") && holidayBody.includes("Browse gifts on Zazzle"), "Holiday HTML uses the approved Zazzle heading and link");
    assert(holidayBody.includes('rel="sponsored noopener noreferrer"'), "Holiday partner links are sponsored");
    assert(holidayBody.includes(disclosure), "Holiday shows the short disclosure");
    assert(!holidayBody.includes("[WORDY"), "Holiday has no pending copy marker");

    const llms = await fetch(base + "/llms.txt");
    const llmsBody = await llms.text();
    assert(llms.status === 200, `llms.txt returned ${llms.status}`);
    assert(llmsBody.includes("As an Amazon Associate I earn from qualifying purchases."), "llms.txt keeps the Associates sentence");
    assert(llmsBody.includes("Pets"), "llms.txt keeps Pets");
    assert(
      llmsBody.includes(
        "- [For AI shopping assistants](https://xvaisle.com/agents): How assistants can browse, and where purchases finish.",
      ),
      "llms.txt policy link",
    );
    assert(llmsBody.includes("Rate limits aren't set yet, so please keep requests light."), "llms.txt rate-limit sentence");
    assert(llmsBody.includes("Tours and things to do for days out with family and friends."), "llms.txt tickets line");
    assert(!llmsBody.includes("AI shopping agents"), "llms.txt does not say AI shopping agents");

    const robotsTxt = await fetch(base + "/robots.txt");
    const robotsBody = await robotsTxt.text();
    assert(robotsTxt.status === 200, `robots.txt returned ${robotsTxt.status}`);
    assert(robotsBody.includes("Sitemap: https://xvaisle.com/sitemap.xml"), "robots.txt sitemap");
    assert(/disallow:\s*\/account/i.test(robotsBody), "robots.txt disallows /account");
    for (const path of ["/desk", "/catalog", "/listings", "/floors", "/scout", "/marketing", "/dev"]) {
      assert(!robotsBody.includes(path), `robots does not advertise ${path}`);
    }
    for (const token of [
      "Googlebot",
      "Storebot-Google",
      "bingbot",
      "Applebot",
      "OAI-SearchBot",
      "ChatGPT-User",
      "Claude-SearchBot",
      "Claude-User",
      "PerplexityBot",
      "Perplexity-User",
      "Amzn-SearchBot",
      "Amzn-User",
      "meta-webindexer",
      "meta-externalfetcher",
    ]) {
      assert(new RegExp(`user-agent:\\s*${token}`, "i").test(robotsBody), `robots.txt names ${token}`);
    }
    for (const token of ["GPTBot", "ClaudeBot", "Google-Extended", "Applebot-Extended", "CCBot"]) {
      assert(!robotsBody.includes(token), `robots.txt does not name ${token}`);
    }

    const agents = await fetch(base + "/agents");
    const agentsBody = decode(await agents.text());
    assert(agents.status === 200, `/agents returned ${agents.status}`);
    for (const line of [
      "For AI shopping assistants · XV-AIsle",
      "How AI shopping assistants can browse XV-AIsle, follow our partner links and help a shopper choose.",
      "For AI shopping assistants",
      "AI shopping assistants are welcome here to browse the aisles and help you choose. Here's how our shelf works, for them and for you.",
      "What assistants can do",
      "Read our public pages, like the home page, the aisles, this page and /llms.txt.",
      "Follow the partner links on any aisle page to help a shopper buy.",
      "Please stay out of",
      "Account, membership, order and API pages. They're private.",
      "Heavy crawling. We haven't set rate limits yet, so please keep requests light.",
      "Prices and buying",
      "Aisle picks don't show a price on our pages. You'll find the current price on the partner's site, where the purchase finishes. We don't take payment for aisle picks.",
      "Prices, shipping and returns are set by the store you buy from, so reach out to that store for help with an order.",
      "How we earn",
      "We may earn a commission when you buy through partner links on our site. Each aisle page shows a disclosure next to its partner links.",
      "As an Amazon Associate I earn from qualifying purchases.",
      "The shopper decides",
      "The shopper you're helping makes the final choice and checks out on the partner's site.",
    ]) {
      assert(agentsBody.includes(line), `/agents is missing ${line}`);
    }
    assert(!agentsBody.includes("AI shopping agents"), "/agents does not say AI shopping agents");
    assertNoPlatformBrands(agentsBody);

    const orders = await fetch(base + "/orders", { redirect: "manual" });
    const ordersBody = await orders.text();
    assert(orders.status === 200, `/orders returned ${orders.status}`);
    assert(!ordersBody.toLowerCase().includes("test mode"), "signed-out /orders omits the test mode line");
    assert(!ordersBody.includes("no real money is charged"), "signed-out /orders omits the test checkout sentence");
    assert(ordersBody.includes("Opening the market"), "signed-out /orders still renders the existing screen");
  } finally {
    await stopServerAndWait(child);
  }
  console.log("affiliate html checks ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
