import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

type BumpType = "patch" | "minor" | "major";

function getPackageRoot(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return join(here, "..");
}

function parseVersion(v: string): [number, number, number] {
  const parts = v.replace(/^v/, "").split(".").map(Number);
  const major = Math.max(0, parts[0] ?? 0);
  const minor = Math.max(0, parts[1] ?? 0);
  const patch = Math.max(0, parts[2] ?? 0);
  return [major, minor, patch];
}

function bump(version: string, type: BumpType): string {
  const [major, minor, patch] = parseVersion(version);
  switch (type) {
    case "major":
      return `${major + 1}.0.0`;
    case "minor":
      return `${major}.${minor + 1}.0`;
    case "patch":
    default:
      return `${major}.${minor}.${patch + 1}`;
  }
}

export async function versionBumpCommand(type: BumpType): Promise<void> {
  const root = getPackageRoot();
  const pkgPath = join(root, "package.json");

  const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { version?: string };
  const current = pkg.version ?? "0.0.0";
  const next = bump(current, type);

  pkg.version = next;
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf8");

  console.log(`${current} → ${next} (${type})`);
}
