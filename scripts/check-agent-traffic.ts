import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import AgentsPage from "../src/app/agents/page";
import { AffiliateSpot } from "../src/components/affiliate-spot";
import { deployedCommit } from "../src/lib/deployed-commit";
import {
  AGENT_TOKENS,
  agentClickLog,
  agentSubIdEnabled,
  clearAgentClickLog,
  isAgentUserAgent,
  runWithTraffic,
  servedTrackingHref,
} from "../src/lib/agent-traffic";
import { amazonPickUrl } from "../src/lib/amazon-aisles";
import { LLMS_NOTE, llmsTxt } from "../src/lib/amazon-aisles";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function decode(html: string) {
  return html.replaceAll("&#x27;", "'").replaceAll("&apos;", "'").replaceAll("&amp;", "&");
}

const BROWSER =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const AGENT = "Mozilla/5.0 (compatible; ChatGPT-User/1.0; +https://openai.com/bot)";
const IMPACT = "https://xvaisle.sjv.io/c/12345?foo=bar";
const AWIN = "https://www.awin1.com/cread.php?awinmid=1&awinaffid=2";
const AMAZON = "https://www.amazon.com/dp/B00006JSUA?tag=xvaisle-20";
const VIATOR = "https://www.viator.com/?pid=P00330828&mcid=42383&medium=link";
const GUIDE = "https://www.getyourguide.com/?partner_id=YEH3QKQ";
const ZAZZLE = "https://www.zazzle.com/?rf=238672294015858667";
const CJ = "https://www.anrdoezrs.net/click-123-456?sid=keep";

const previous = process.env.AGENT_SUBID;
process.env.AGENT_SUBID = "on";

function keysOf(row: object) {
  return Object.keys(row).sort().join();
}

try {
  assert(agentSubIdEnabled("on") === true, "on enables the sub-id");
  assert(agentSubIdEnabled(undefined) === true, "an unset switch stays on");
  assert(agentSubIdEnabled("off") === false, "off disables the sub-id");
  assert(agentSubIdEnabled(" OFF ") === false, "off is case-insensitive");

  for (const token of AGENT_TOKENS) {
    assert(isAgentUserAgent(`Mozilla/5.0 (${token}/1.0)`), `${token} is an agent`);
  }
  assert(!isAgentUserAgent(BROWSER), "a browser user agent is not an agent");
  assert(!isAgentUserAgent("Mozilla/5.0 AppleWebKit/537.36"), "AppleWebKit is not Applebot");

  clearAgentClickLog();
  const impact = servedTrackingHref(IMPACT, "impact-sample", { userAgent: AGENT, path: "/aisles/tickets-and-events" });
  assert(impact === `${IMPACT}&subId1=agent`, "an agent with the switch on appends subId1 and keeps the query");
  const awin = servedTrackingHref(AWIN, "awin-sample", { userAgent: AGENT, path: "/shop" });
  assert(awin === `${AWIN}&clickref=agent`, "an agent with the switch on appends clickref and keeps the query");
  const agentLog = agentClickLog();
  assert(agentLog.length === 2, "the agent requests were logged");
  assert(agentLog.every((row) => row.source === "agent" && row.subIdAppended), "agent rows record the sub-id");
  assert(agentLog[0]?.network === "impact" && agentLog[0].id === "impact-sample", "the impact row names the product");
  assert(agentLog[1]?.network === "awin" && agentLog[1].path === "/shop", "the awin row keeps the path");

  clearAgentClickLog();
  const browserImpact = servedTrackingHref(IMPACT, "impact-sample", { userAgent: BROWSER, path: "/aisles/kitchen" });
  assert(browserImpact === IMPACT, "a browser leaves an Impact link unchanged");
  const browserLog = agentClickLog();
  assert(browserLog.length === 1 && browserLog[0]?.source === "human" && browserLog[0].subIdAppended === false, "a browser is logged as human");

  clearAgentClickLog();
  process.env.AGENT_SUBID = "off";
  const switchedOff = servedTrackingHref(IMPACT, "impact-sample", { userAgent: AGENT, path: "/aisles/kitchen" });
  assert(switchedOff === IMPACT, "off leaves an Impact link unchanged");
  const offLog = agentClickLog();
  assert(offLog[0]?.source === "agent" && offLog[0].subIdAppended === false, "off still records the agent and appends nothing");
  process.env.AGENT_SUBID = "on";

  clearAgentClickLog();
  const amazon = runWithTraffic({ userAgent: AGENT, path: "/aisles/kitchen" }, () => amazonPickUrl("B00006JSUA"));
  assert(amazon === AMAZON, "an Amazon URL stays exactly tag=xvaisle-20");
  assert(!amazon.includes("subId1") && !amazon.includes("clickref"), "an Amazon URL gains no tracking param");
  const amazonLog = agentClickLog();
  assert(amazonLog[0]?.network === "amazon" && amazonLog[0].source === "agent" && amazonLog[0].subIdAppended === false, "Amazon is logged and not rewritten");
  assert(amazonLog[0]?.id === "B00006JSUA", "the Amazon row uses the ASIN");

  for (const href of [VIATOR, GUIDE, ZAZZLE, CJ]) {
    assert(servedTrackingHref(href, "partner", { userAgent: AGENT, path: "/aisles/tickets-and-events" }) === href, `${href} stays unchanged`);
  }
  const already = servedTrackingHref(`${IMPACT}&subId1=keep`, "impact-sample", { userAgent: AGENT, path: "/aisles/kitchen" });
  assert(already === `${IMPACT}&subId1=keep`, "an existing subId1 is preserved");

  clearAgentClickLog();
  servedTrackingHref(AWIN, "not an id", {
    userAgent: `${AGENT} person@example.com 203.0.113.10`,
    path: "/aisles/kitchen?email=person@example.com&cookie=session",
  });
  const pii = agentClickLog()[0];
  assert(pii, "the pii probe was logged");
  const dumped = JSON.stringify(pii);
  assert(!dumped.includes("person@example.com"), "the log drops the email");
  assert(!dumped.includes("203.0.113.10"), "the log drops the address");
  assert(!dumped.includes("cookie"), "the log drops the cookie");
  assert(!dumped.toLowerCase().includes("user-agent") && !dumped.includes("ChatGPT-User"), "the log drops the user agent");
  assert(pii.id === "" && pii.path === "/aisles/kitchen", "an unsafe id is dropped and the path keeps no query");
  assert(keysOf(pii) === "id,network,path,source,subIdAppended,timestamp", "the log keeps only the click fields");

  const spot = renderToStaticMarkup(
    createElement(AffiliateSpot, {
      spot: "experiences",
      traffic: { userAgent: AGENT, path: "/aisles/tickets-and-events" },
    }),
  );
  assert(spot.includes(VIATOR.replaceAll("&", "&amp;")) && spot.includes(GUIDE), "AffiliateSpot leaves Viator and GetYourGuide hrefs unchanged");
  assert(!spot.includes("subId1") && !spot.includes("clickref"), "AffiliateSpot does not add a sub-id to those hrefs");

  const page = decode(renderToStaticMarkup(createElement(AgentsPage)));
  for (const line of [
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
    assert(page.includes(line), `the assistants page is missing ${line}`);
  }
  assert(!page.includes("AI shopping agents"), "the assistants page does not say AI shopping agents");
  const llms = llmsTxt();
  assert(llms.includes(LLMS_NOTE), "llms.txt includes the note");
  assert(llms.includes("Rate limits aren't set yet, so please keep requests light."), "the llms rate-limit sentence");
  assert(page.includes("We haven't set rate limits yet, so please keep requests light."), "the page rate-limit sentence");

  const previousCommit = process.env.DEPLOYED_COMMIT;
  const previousFile = process.env.DEPLOYED_COMMIT_FILE;
  process.env.DEPLOYED_COMMIT = "abc123";
  assert(deployedCommit() === "abc123", "DEPLOYED_COMMIT comes from the environment");
  delete process.env.DEPLOYED_COMMIT;
  const file = join(mkdtempSync(join(tmpdir(), "xvaisle-commit-")), "DEPLOYED_COMMIT");
  writeFileSync(file, "def456\n");
  process.env.DEPLOYED_COMMIT_FILE = file;
  assert(deployedCommit() === "def456", "a missing variable falls back to the image file");
  if (previousCommit == null) delete process.env.DEPLOYED_COMMIT;
  else process.env.DEPLOYED_COMMIT = previousCommit;
  if (previousFile == null) delete process.env.DEPLOYED_COMMIT_FILE;
  else process.env.DEPLOYED_COMMIT_FILE = previousFile;

  console.log("agent traffic checks ok");
} finally {
  if (previous == null) delete process.env.AGENT_SUBID;
  else process.env.AGENT_SUBID = previous;
}
