import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const FIELDS = {
  previewModeId: "__NEXT_PREVIEW_MODE_ID",
  previewModeSigningKey: "__NEXT_PREVIEW_MODE_SIGNING_KEY",
  previewModeEncryptionKey: "__NEXT_PREVIEW_MODE_ENCRYPTION_KEY",
  encryptionKey: "NEXT_SERVER_ACTIONS_ENCRYPTION_KEY",
};

function material(name) {
  const fromEnv = process.env[name];
  if (typeof fromEnv === "string" && fromEnv.trim()) return fromEnv.trim();
  return randomBytes(32).toString("hex");
}

const values = Object.fromEntries(Object.entries(FIELDS).map(([field, envName]) => [field, material(envName)]));

function assign(value) {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (Object.prototype.hasOwnProperty.call(values, key) && typeof child === "string") value[key] = values[key];
    else assign(child);
  }
}

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const info = statSync(path);
    if (info.isDirectory()) {
      walk(path);
      continue;
    }
    if (!path.endsWith("/prerender-manifest.json") && !path.endsWith("/server-reference-manifest.json")) continue;
    const json = JSON.parse(readFileSync(path, "utf8"));
    assign(json);
    writeFileSync(path, `${JSON.stringify(json)}\n`);
  }
}

walk("/app/.next");

const env = { ...process.env };
for (const [field, envName] of Object.entries(FIELDS)) {
  const current = process.env[envName];
  if (typeof current !== "string" || !current.trim()) env[envName] = values[field];
}

const child = spawn("node", ["server.js"], { stdio: "inherit", env });
child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
