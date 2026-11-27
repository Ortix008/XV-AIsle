import { spawn } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const BUILD_ID = ".next/BUILD_ID";
const SOURCE_ROOTS = ["src", "public", "package.json", "next.config.ts", "next.config.js", "tsconfig.json"];

function latestMtime(path: string): number {
  if (!existsSync(path)) return 0;
  const info = statSync(path);
  if (!info.isDirectory()) return info.mtimeMs;
  return readdirSync(path).reduce((latest, name) => {
    if (name === "node_modules" || name === ".next" || name === ".git") return latest;
    return Math.max(latest, latestMtime(join(path, name)));
  }, 0);
}

function needsBuild() {
  if (!existsSync(BUILD_ID)) return true;
  const builtAt = statSync(BUILD_ID).mtimeMs;
  return SOURCE_ROOTS.some((root) => latestMtime(root) > builtAt);
}

function run(command: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      stdio: "inherit",
      env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
    });
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} ${signal ? `got ${signal}` : `exited ${code}`}`));
    });
  });
}

async function main() {
  if (needsBuild()) {
    await run("npm", ["run", "build"]);
  }
  await run("npx", ["tsx", "scripts/check-affiliate-html.ts"]);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
