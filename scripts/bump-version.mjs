#!/usr/bin/env node
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import semver from "semver";

const type = process.argv[2] || "patch";
if (!["patch", "minor", "major"].includes(type)) {
  console.error("Usage: node scripts/bump-version.mjs [patch|minor|major]");
  process.exit(1);
}

const root = join(fileURLToPath(import.meta.url), "..", "..");
const pkgPath = join(root, "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
const current = (pkg.version || "0.0.0").replace(/^v/, "");

if (!semver.valid(current)) {
  console.error(`Invalid version in package.json: ${pkg.version}`);
  process.exit(1);
}

const next = semver.inc(current, type);
if (!next) {
  console.error(`semver.inc failed for ${current} (${type})`);
  process.exit(1);
}

pkg.version = next;
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf8");
console.log(`${current} → ${next} (${type})`);
