import { spawn } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const forbidden = ["Viator", "GetYourGuide", "Zazzle", "Bookshop", "[WORDY"];
const routes = ["/", "/shop?aisle=home-and-gifts", "/aisles/tickets-and-events"];
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
    for (const route of routes) {
      const response = await fetch(base + route);
      const body = await response.text();
      const expected = route === "/aisles/tickets-and-events" ? 404 : 200;
      assert(response.status === expected, `${route} returned ${response.status}`);
      for (const word of forbidden) {
        assert(!body.includes(word), `${route} HTML/RSC includes ${word}`);
      }
    }
  } finally {
    child.kill("SIGTERM");
  }
  console.log("affiliate html checks ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
