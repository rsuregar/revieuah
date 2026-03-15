import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getPackageRoot } from "../lib/package-root.js";

/**
 * Finds the ReviuAh project root. Priority: (1) cwd if it has package.json with name "reviuah",
 * (2) directory containing the running script (e.g. installed package). Returns null if neither is a reviuah project.
 * When both are valid (e.g. running from repo root), cwd wins so behavior is deterministic for development.
 */
function findReviuahRoot(): string | null {
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

  const fromScript = getPackageRoot();
  const fromScriptPkg = join(fromScript, "package.json");
  if (existsSync(fromScriptPkg)) return fromScript;

  return null;
}

export interface UpdateCommandOptions {
  noBuild?: boolean;
  /** If true, run install only (lockfile); no upgrade. Use to avoid unexpected dependency version bumps. */
  installOnly?: boolean;
}

export async function updateCommand(opts: UpdateCommandOptions = {}): Promise<void> {
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
  const installOnly = opts.installOnly === true;

  if (installOnly) {
    console.error("Installing dependencies from lockfile...");
  } else {
    console.error("Updating dependencies (upgrade within semver)...");
  }
  try {
    run(installOnly ? (useYarn ? "yarn install" : "npm install") : (useYarn ? "yarn upgrade" : "npm update"));
  } catch {
    console.error(installOnly ? "Install failed." : "Update failed.");
    return;
  }

  const shouldBuild = !opts.noBuild && existsSync(join(root, "tsconfig.json"));
  const doneVerb = installOnly ? "installed" : "upgraded";
  if (shouldBuild) {
    console.error("Building...");
    try {
      run(useYarn ? "yarn build" : "npm run build");
    } catch {
      console.error("Build failed.");
      return;
    }
    console.error(`Done: dependencies ${doneVerb} and build succeeded.`);
  } else {
    if (opts.noBuild) {
      console.error(`Done: dependencies ${doneVerb}. (Build skipped by --no-build.)`);
    } else {
      console.error(`Done: dependencies ${doneVerb}. Build skipped as no tsconfig.json was found. If a build is required, please run it manually.`);
    }
  }
}
