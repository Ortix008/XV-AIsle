import { readFileSync } from "node:fs";
import { join } from "node:path";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const REM = 16;
const SPACING = 0.25 * REM;
const SHELL = 80 * REM;
const CLUSTER = 36 * REM;

function contentMargins(viewport: number) {
  const shell = Math.min(viewport, SHELL);
  const shellLeft = (viewport - shell) / 2;
  const pad = viewport >= 640 ? SPACING * 10 : SPACING * 5;
  const inner = shell - pad * 2;
  const width = Math.min(inner, CLUSTER);
  const left = shellLeft + pad + (inner - width) / 2;
  const right = viewport - left - width;
  return { left, right, width };
}

function rule(css: string, selector: string) {
  const pattern = new RegExp(`${selector.replaceAll(".", "\\.")}\\s*\\{([^}]*)\\}`);
  const found = css.match(pattern);
  const body = found?.[1];
  if (!body) throw new Error(`${selector} is missing`);
  return body;
}

function mediaContaining(css: string, needle: string) {
  const header = "@media (min-width: 640px)";
  let from = 0;
  while (from < css.length) {
    const start = css.indexOf(header, from);
    if (start < 0) break;
    const open = css.indexOf("{", start);
    let depth = 0;
    let closed = false;
    for (let i = open; i < css.length; i++) {
      const char = css[i];
      if (char === "{") depth += 1;
      else if (char === "}") {
        depth -= 1;
        if (depth === 0) {
          const block = css.slice(start, i + 1);
          if (block.includes(needle)) return block;
          from = i + 1;
          closed = true;
          break;
        }
      }
    }
    if (!closed) break;
  }
  throw new Error("the wide 404 layout is missing");
}

const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
const page = readFileSync(join(process.cwd(), "src/app/not-found.tsx"), "utf8");
const copy = rule(css, ".lost-aisle-copy");
const cluster = rule(css, ".lost-aisle-cluster");
const wide = mediaContaining(css, ".lost-aisle-copy");
const wideCopy = rule(wide, ".lost-aisle-copy");
const wideCluster = rule(wide, ".lost-aisle-cluster");

assert(copy.includes("box-sizing: border-box"), "the 404 shell uses border-box");
assert(copy.includes("width: 100%"), "the 404 shell fills the page");
assert(copy.includes("max-width: var(--container-7xl)"), "the 404 shell uses the site container");
assert(copy.includes("margin-inline: auto"), "the 404 shell is centered");
assert(copy.includes("padding: 3.25rem calc(var(--spacing) * 5) 4rem"), "the 404 shell uses the spacing token");
assert(wideCopy.includes("padding: 5rem calc(var(--spacing) * 10) 5rem"), "the wide 404 shell uses the spacing token");
assert(cluster.includes("box-sizing: border-box"), "the 404 cluster uses border-box");
assert(cluster.includes("width: 100%"), "the 404 cluster fills the shell");
assert(cluster.includes("max-width: var(--container-xl)"), "the 404 cluster uses the content measure");
assert(cluster.includes("margin-inline: auto"), "the 404 cluster is centered in the shell");
assert(wideCluster.includes("align-items: center"), "the wide 404 centers the heading and button");
assert(wideCluster.includes("text-align: center"), "the wide 404 centers the heading text");
assert(wide.includes(".lost-aisle-cluster > ul") && wide.includes("text-align: start"), "tile labels stay left inside the centered grid");
assert(page.includes('className="lost-aisle-cluster"'), "the 404 page uses the centered cluster");
assert(!page.includes("max-w-xl"), "the 404 tiles are not a left-aligned narrow grid");

for (const viewport of [390, 1280, 1600]) {
  const { left, right } = contentMargins(viewport);
  assert(Math.abs(left - right) < 0.5, `the 404 content is horizontally centered at ${viewport}`);
}

const desktop = contentMargins(1280);
assert(desktop.left === 352 && desktop.right === 352, "the 404 content is horizontally centered at 1280");
assert(desktop.width === CLUSTER, "the 404 content keeps the site content measure at 1280");
