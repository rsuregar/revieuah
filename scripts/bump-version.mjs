#!/usr/bin/env node
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";

const type = process.argv[2] || "patch";
if (!["patch", "minor", "major"].includes(type)) {
  console.error("Usage: node scripts/bump-version.mjs [patch|minor|major]");
  process.exit(1);
}

const root = join(fileURLToPath(import.meta.url), "..", "..");
const pkgPath = join(root, "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
const [major, minor, patch] = (pkg.version || "0.0.0").replace(/^v/, "").split(".").map(Number);

let next;
if (type === "major") next = `${(major || 0) + 1}.0.0`;
else if (type === "minor") next = `${major || 0}.${(minor || 0) + 1}.0`;
else next = `${major || 0}.${minor || 0}.${(patch || 0) + 1}`;

const prev = pkg.version;
pkg.version = next;
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf8");
console.log(`${prev} → ${next} (${type})`);
