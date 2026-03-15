import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const PACKAGE_NAME = "reviuah";
const require = createRequire(import.meta.url);

const YELLOW = "\x1b[33m";
const BOLD = "\x1b[1m";
const GRAY = "\x1b[90m";
const RESET = "\x1b[0m";

interface NpmRegistryResponse {
  "dist-tags"?: {
    latest?: string;
  };
}

function getCurrentVersion(): string {
  try {
    const scriptDir = dirname(fileURLToPath(import.meta.url));
    const root = join(scriptDir, "..", "..");
    const pkg = require(join(root, "package.json")) as { version?: string };
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

function isNewVersionAvailable(
  currentVersion: string,
  latestVersion: string,
): boolean {
  const currentParts = currentVersion.split(".").map(Number);
  const latestParts = latestVersion.split(".").map(Number);

  for (let i = 0; i < latestParts.length; i++) {
    if (latestParts[i]! > (currentParts[i] ?? 0)) return true;
    if (latestParts[i]! < (currentParts[i] ?? 0)) return false;
  }
  return false;
}

/**
 * Check npm registry for newer version and print a one-line notice (Commitah-style).
 * Silently fails so it never blocks the tool.
 */
export async function checkForUpdates(): Promise<void> {
  if (process.env.CI === "true" || process.env.GITHUB_ACTIONS === "true") {
    return;
  }
  try {
    const currentVersion = getCurrentVersion();
    const response = await fetch(
      `https://registry.npmjs.org/${PACKAGE_NAME}`,
      { signal: AbortSignal.timeout(3000) },
    );
    if (!response.ok) return;

    const data = (await response.json()) as NpmRegistryResponse;
    const latestVersion = data["dist-tags"]?.latest?.trim();
    if (!latestVersion) return;

    if (isNewVersionAvailable(currentVersion, latestVersion)) {
      console.log(
        `${YELLOW}\nNew version available: ${BOLD}${latestVersion}${RESET}${YELLOW} (current: ${currentVersion})${RESET}`,
      );
      console.log(
        `${GRAY}Update manually with: npm install -g ${PACKAGE_NAME}@latest\n${RESET}`,
      );
    }
  } catch {
    // Silently fail - don't block the tool for update issues
  }
}
