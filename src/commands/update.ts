import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getPackageRoot } from "../lib/package-root.js";

function findReviuahRoot(): string | null {
  const fromScript = getPackageRoot();
  const fromScriptPkg = join(fromScript, "package.json");
  if (existsSync(fromScriptPkg)) return fromScript;

  const cwd = process.cwd();
  const cwdPkg = join(cwd, "package.json");
  if (existsSync(cwdPkg)) {
    try {
      const pkg = JSON.parse(readFileSync(cwdPkg, "utf8")) as { name?: string };
      if (pkg.name === "reviuah") return cwd;
    } catch {
      /* ignore */
    }
  }
  return null;
}

export async function updateCommand(): Promise<void> {
  const root = findReviuahRoot();
  if (!root) {
    console.error("package.json not found. Run this command from the ReviuAh project root.");
    process.exitCode = 1;
    return;
  }

  const pkgPath = join(root, "package.json");

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
