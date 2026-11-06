import { mkdtempSync, readFileSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PersonalizedForm } from "../src/components/personalized-form";
import {
  PERSONALIZED_CLOSED,
  PERSONALIZED_PURCHASES_OPEN,
  cleanPersonalizedText,
  formatJobSheet,
  type PersonalizedJob,
} from "../src/lib/personalized";

process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), "xvaisle-personalized-")), "personalized.sqlite");
delete process.env.STRIPE_SECRET_KEY;

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

function walk(dir: string): string[] {
  const found: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) found.push(...walk(path));
    else if (name.endsWith(".ts") || name.endsWith(".tsx") || name.endsWith(".md")) found.push(path);
  }
  return found;
}

const machine = ["Cri", "cut"].join("");

async function main() {
  assert(PERSONALIZED_PURCHASES_OPEN === false, "personalized purchases stay closed");
  assert(cleanPersonalizedText("  Ada  ").text === "Ada", "letters are trimmed");
  assert("error" in cleanPersonalizedText("   "), "an empty name is refused");
  assert("error" in cleanPersonalizedText("A".repeat(41)), "a long name is refused");
  assert(cleanPersonalizedText("Ada\u0000 Lane").text === "Ada Lane", "control characters are removed");

  const job: PersonalizedJob = {
    id: "job-1",
    orderId: null,
    designId: "none",
    designVersion: "0",
    customText: "Ada",
    material: null,
    color: null,
    sizeLabel: null,
    qty: 1,
    productionStatus: "new",
    carrier: null,
    trackingNumber: null,
  };
  const sheet = formatJobSheet(job);
  assert(sheet.includes("Text Ada") && sheet.includes("Order not paid"), "the sheet keeps the letters and the unpaid state");
  assert(!/email|street|@|line1/i.test(sheet), "the sheet has no buyer contact");

  const form = renderToStaticMarkup(createElement(PersonalizedForm, null));
  assert(form.includes("Approved designs: none yet"), "the form says no design is approved");
  assert(form.includes("Not available to purchase"), "the form does not offer a buy button");
  assert(!form.toLowerCase().includes(machine.toLowerCase()), "the form does not name the machine");
  assert(!form.includes('type="file"'), "the form does not accept a file");

  for (const path of walk(join(process.cwd(), "src"))) {
    if (!path.includes("personalized") && !path.endsWith("store-header.tsx") && !path.endsWith("shop-footer.tsx")) continue;
    const source = readFileSync(path, "utf8");
    assert(!source.toLowerCase().includes(machine.toLowerCase()), `${path} names the machine`);
  }

  const { getDb } = await import("../src/lib/server/db");
  const { savePersonalizedJob } = await import("../src/lib/server/personalized-jobs");
  const { POST, GET } = await import("../src/app/api/personalized/route");
  const { GET: jobsGet } = await import("../src/app/api/personalized/jobs/route");
  const { signUp } = await import("../src/lib/server/accounts");
  const { SESSION_COOKIE } = await import("../src/lib/server/session-cookie");

  const before = (getDb().prepare("SELECT COUNT(*) AS n FROM orders").get() as { n: number }).n;
  const jobsBefore = (getDb().prepare("SELECT COUNT(*) AS n FROM personalized_jobs").get() as { n: number }).n;
  const closed = savePersonalizedJob({ customText: "Ada" });
  assert(closed.error === PERSONALIZED_CLOSED, "a valid name still does not open an order");
  const blank = await POST(
    new Request("http://127.0.0.1/api/personalized", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ customText: " " }),
    }),
  );
  const blankBody = (await blank.json()) as { error?: string };
  assert(blank.status === 400 && blankBody.error === "Add the name or monogram.", "the server refuses an empty name");
  const refused = await POST(
    new Request("http://127.0.0.1/api/personalized", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ customText: "Ada" }),
    }),
  );
  const refusedBody = (await refused.json()) as { error?: string; url?: string };
  assert(refused.status === 403 && refusedBody.error === PERSONALIZED_CLOSED && !refusedBody.url, "checkout stays closed");
  const after = (getDb().prepare("SELECT COUNT(*) AS n FROM orders").get() as { n: number }).n;
  const jobsAfter = (getDb().prepare("SELECT COUNT(*) AS n FROM personalized_jobs").get() as { n: number }).n;
  assert(after === before && jobsAfter === jobsBefore, "a closed personalized request writes nothing");

  const catalog = (await (await GET()).json()) as { open?: boolean; designs?: unknown[] };
  assert(catalog.open === false && catalog.designs?.length === 0, "the public catalog has no approved design");

  const stranger = await jobsGet(new Request("http://127.0.0.1/api/personalized/jobs"));
  assert(stranger.status === 403, "job tickets are not public");
  const joined = signUp({ name: "Personalized Operator", email: "personalized-operator@example.com", password: "personalized-test" });
  if ("error" in joined) throw new Error(joined.error);
  getDb().prepare("UPDATE accounts SET role = 'admin', email_verified = 1 WHERE id = ?").run(joined.account.id);
  const operator = await jobsGet(
    new Request("http://127.0.0.1/api/personalized/jobs", { headers: { cookie: `${SESSION_COOKIE}=${joined.token}` } }),
  );
  const operatorBody = (await operator.json()) as { jobs?: unknown[]; line1?: string };
  assert(operator.status === 200 && operatorBody.jobs?.length === 0, "a verified operator sees an empty queue");
  assert(!JSON.stringify(operatorBody).includes("line1") && !JSON.stringify(operatorBody).includes("@"), "the queue has no buyer contact");

  console.log("personalized checks ok");
}

main();
