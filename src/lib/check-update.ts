import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { execSync } from "node:child_process";
import * as readline from "node:readline";
import semver from "semver";
import { showUpdatePrompt } from "../ui/update-prompt.js";

const PACKAGE_NAME = "reviuah";
const require = createRequire(import.meta.url);

const YELLOW = "\x1b[33m";
const GREEN = "\x1b[32m";
const BOLD = "\x1b[1m";
const GRAY = "\x1b[90m";
const CYAN = "\x1b[36m";
const RESET = "\x1b[0m";

const LANG = (process.env.REVIUAH_LANG || process.env.LANG || "").toLowerCase();
const isId = LANG.startsWith("id");

const MSG = {
  newVersion: isId
    ? "Versi baru tersedia:"
    : "New version available:",
  current: isId ? "saat ini" : "current",
  whatsNew: isId ? "Perubahan terbaru:" : "What's new:",
  updateNow: isId ? "Update sekarang? (y/Tidak): " : "Update now? (y/N): ",
  updating: isId ? "Memperbarui ke" : "Updating to",
  updated: isId ? "Berhasil diperbarui ke" : "Updated to",
  skip: isId ? "Dilewati. Update nanti:" : "Skip. Update later:",
  updateManual: isId ? "Update manual:" : "Update:",
  or: isId ? "atau" : "or",
} as const;

interface NpmRegistryResponse {
  "dist-tags"?: { latest?: string };
  versions?: Record<string, { version?: string; description?: string }>;
  time?: Record<string, string>;
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

/** Exported for testing. Returns up to 5 newer versions sorted newest first. */
export function getNewerVersions(
  current: string,
  time: Record<string, string>,
): { version: string; date: string }[] {
  return Object.entries(time)
    .filter(([key]) => key !== "created" && key !== "modified" && semver.valid(key) && semver.gt(key, current))
    .map(([version, date]) => ({ version, date: date.slice(0, 10) }))
    .sort((a, b) => semver.rcompare(a.version, b.version))
    .slice(0, 5);
}

function askYesNo(question: string): Promise<boolean> {
  return new Promise((resolve) => {
    // Use stderr so prompt is visible when stdout is redirected (same as other update messages)
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stderr,
    });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === "y" || answer.trim().toLowerCase() === "yes");
    });
  });
}

function doUpdate(latest: string): boolean {
  console.error(`${CYAN}${MSG.updating} ${latest}...${RESET}`);
  try {
    execSync(`npm install -g ${PACKAGE_NAME}@${latest}`, { stdio: "inherit" });
    console.error(`${GREEN}${MSG.updated} ${latest}!${RESET}\n`);
    return true;
  } catch {
    console.error(`${YELLOW}Update failed. Run manually: npm install -g ${PACKAGE_NAME}@latest${RESET}\n`);
    return false;
  }
}

async function showFallbackUpdatePrompt(
  latestVersion: string,
  currentVersion: string,
  newer: { version: string; date: string }[],
): Promise<void> {
  console.error("");
  console.error(
    `${YELLOW}${BOLD}${MSG.newVersion} ${latestVersion}${RESET} ${YELLOW}(${MSG.current}: ${currentVersion})${RESET}`,
  );
  if (newer.length > 0) {
    console.error(`${GRAY}${MSG.whatsNew}${RESET}`);
    for (const v of newer) {
      console.error(`${GRAY}  • ${v.version} (${v.date})${RESET}`);
    }
  }
  console.error("");
  const yes = await askYesNo(`${CYAN}${MSG.updateNow}${RESET}`);
  if (yes) {
    doUpdate(latestVersion);
  } else {
    console.error(
      `${GRAY}${MSG.skip} npm install -g ${PACKAGE_NAME}@latest${RESET}\n`,
    );
  }
}

/**
 * CLI mode: check for updates, show what's new, ask to update (y/n).
 * Skipped in CI. Silently fails on network errors.
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
    if (!latestVersion || !semver.valid(latestVersion) || !semver.gt(latestVersion, currentVersion)) return;

    const newer = getNewerVersions(currentVersion, data.time ?? {});

    if (process.stdin.isTTY && process.stderr.isTTY) {
      try {
        const doUpdateNow = await showUpdatePrompt({
          latestVersion: latestVersion,
          currentVersion: currentVersion,
          newerVersions: newer,
          lang: isId ? "id" : "en",
        });
        if (doUpdateNow) {
          doUpdate(latestVersion);
        } else {
          console.error(
            `${GRAY}${MSG.skip} npm install -g ${PACKAGE_NAME}@latest${RESET}\n`,
          );
        }
      } catch {
        await showFallbackUpdatePrompt(latestVersion, currentVersion, newer);
      }
    } else if (process.stdin.isTTY) {
      await showFallbackUpdatePrompt(latestVersion, currentVersion, newer);
    } else {
      console.error(
        `${YELLOW}${BOLD}${MSG.newVersion} ${latestVersion}${RESET} ${YELLOW}(${MSG.current}: ${currentVersion})${RESET}`,
      );
      if (newer.length > 0) {
        console.error(`${GRAY}${MSG.whatsNew}${RESET}`);
        for (const v of newer) {
          console.error(`${GRAY}  • ${v.version} (${v.date})${RESET}`);
        }
      }
      console.error(
        `\n${GRAY}${MSG.updateManual} npm install -g ${PACKAGE_NAME}@latest  ${MSG.or}  yarn global add ${PACKAGE_NAME}@latest\n${RESET}`,
      );
    }
  } catch {
    // Silently fail
  }
}
