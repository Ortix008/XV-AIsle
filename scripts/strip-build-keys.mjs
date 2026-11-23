import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const KEY_NAMES = ["previewModeId", "previewModeSigningKey", "previewModeEncryptionKey", "encryptionKey"];
const PLACEHOLDER = "placeholder";

function walk(dir, visit) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules") continue;
    const path = join(dir, name);
    const info = statSync(path);
    if (info.isDirectory()) walk(path, visit);
    else visit(path, info);
  }
}

function collect(value, found) {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (KEY_NAMES.includes(key) && typeof child === "string" && child.length > 0) {
      found.push([key, child]);
    }
    collect(child, found);
  }
}

function blank(value) {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (KEY_NAMES.includes(key) && typeof child === "string") value[key] = PLACEHOLDER;
    else blank(child);
  }
}

const root = process.argv[2] || ".next";
const manifests = [];
walk(root, (path) => {
  if (path.endsWith("/prerender-manifest.json") || path.endsWith("/server-reference-manifest.json")) {
    manifests.push(path);
  }
});

const replacements = new Map();
for (const file of manifests) {
  const json = JSON.parse(readFileSync(file, "utf8"));
  const found = [];
  collect(json, found);
  for (const [name, value] of found) {
    if (value !== PLACEHOLDER) replacements.set(value, name);
  }
  blank(json);
  writeFileSync(file, `${JSON.stringify(json)}\n`);
}

const reported = new Set();
for (const [value, name] of replacements) {
  if (reported.has(name)) continue;
  reported.add(name);
  console.log(`${name} length ${value.length}`);
}

if (replacements.size === 0) process.exit(0);

walk(root, (path, info) => {
  if (info.size > 8_000_000 || info.size === 0) return;
  const bytes = readFileSync(path);
  if (bytes.includes(0)) return;
  let text = bytes.toString("utf8");
  let changed = false;
  for (const value of replacements.keys()) {
    if (text.includes(value)) {
      text = text.split(value).join(PLACEHOLDER);
      changed = true;
    }
  }
  if (changed) writeFileSync(path, text);
});
