import { readFileSync } from "node:fs";

/** Git sha baked into the image. The environment wins; the image file is the fallback. */
export function deployedCommit(
  env: NodeJS.ProcessEnv = process.env,
  file = env.DEPLOYED_COMMIT_FILE ?? "/app/DEPLOYED_COMMIT",
) {
  const fromEnv = env.DEPLOYED_COMMIT?.trim() ?? "";
  if (fromEnv) return fromEnv;
  try {
    return readFileSync(file, "utf8").trim();
  } catch {
    return "";
  }
}
