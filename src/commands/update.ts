import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getPackageRoot } from "../lib/package-root.js";

export async function updateCommand(): Promise<void> {
  const root = getPackageRoot();
  const pkgPath = join(root, "package.json");

  if (!existsSync(pkgPath)) {
    console.error("package.json not found. Run from the reviuah project.");
    return;
  }

  let pkg: { name?: string; scripts?: { build?: string } };
  try {
    pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  } catch {
    console.error("Failed to read package.json.");
    return;
  }

  if (pkg.name !== "reviuah" || !pkg.scripts?.build) {
    console.error("Not a reviuah project or missing build script.");
    return;
  }

  const useYarn = existsSync(join(root, "yarn.lock"));
  const run = (cmd: string) => execSync(cmd, { cwd: root, stdio: "inherit" });

  console.error("Installing dependencies...");
  try {
    run(useYarn ? "yarn install" : "npm install");
  } catch {
    console.error("Install failed.");
    return;
  }

  console.error("Building...");
  try {
    run(useYarn ? "yarn build" : "npm run build");
  } catch {
    console.error("Build failed.");
    return;
  }

  console.error("Done: dependencies updated and build succeeded.");
}
