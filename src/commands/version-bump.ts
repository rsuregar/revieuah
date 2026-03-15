import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import semver from "semver";
import { getPackageRoot } from "../lib/package-root.js";

type BumpType = "patch" | "minor" | "major";

export async function versionBumpCommand(type: BumpType): Promise<void> {
  const pkgPath = join(getPackageRoot(), "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { version?: string };
  const current = (pkg.version ?? "0.0.0").replace(/^v/, "");

  if (!semver.valid(current)) {
    throw new Error(`Invalid version in package.json: ${pkg.version}`);
  }

  const next = semver.inc(current, type);
  if (!next) {
    throw new Error(`semver.inc failed for ${current} (${type})`);
  }

  pkg.version = next;
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf8");
  console.log(`${current} → ${next} (${type})`);
}
