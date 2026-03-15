const NPM_REGISTRY = "https://registry.npmjs.org";
const PACKAGE_NAME = "reviuah";

/** Simple semver-like compare: returns true if a < b (a is older). */
function isOlder(a: string, b: string): boolean {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const va = pa[i] ?? 0;
    const vb = pb[i] ?? 0;
    if (va < vb) return true;
    if (va > vb) return false;
  }
  return false;
}

export interface UpdateInfo {
  current: string;
  latest: string;
}

/**
 * Fetches latest version from npm registry. Returns null on error or when not needed.
 */
export async function getUpdateInfo(
  currentVersion: string,
): Promise<UpdateInfo | null> {
  if (process.env.CI === "true" || process.env.GITHUB_ACTIONS === "true") {
    return null;
  }
  try {
    const res = await fetch(`${NPM_REGISTRY}/${PACKAGE_NAME}/latest`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { version?: string };
    const latest = data.version?.trim();
    if (!latest || !isOlder(currentVersion, latest)) return null;
    return { current: currentVersion, latest };
  } catch {
    return null;
  }
}

export function printUpdateMessage(info: UpdateInfo): void {
  console.error(
    `\nreviuah: A new version (${info.latest}) is available. You have ${info.current}.`,
  );
  console.error("Run: npm install -g reviuah");
}

/**
 * Ask user if they want to update now (TTY only). Returns true if they said yes.
 */
export async function promptUpdateNow(): Promise<boolean> {
  if (!process.stdin.isTTY) return false;
  const readline = await import("node:readline/promises");
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stderr,
  });
  try {
    const answer = (await rl.question("Update now? [y/N]: ")).trim().toLowerCase();
    return answer === "y" || answer === "yes";
  } finally {
    rl.close();
  }
}

/**
 * Run npm install -g reviuah. Preserves exit code.
 */
export async function runUpdate(): Promise<void> {
  const { execa } = await import("execa");
  try {
    await execa("npm", ["install", "-g", PACKAGE_NAME], {
      stdio: "inherit",
    });
  } catch {
    process.exitCode = process.exitCode || 1;
  }
}
