#!/usr/bin/env node
/** Run build after install when in development repo (has src/ and tsconfig.json). prepublishOnly handles build on publish. */
import { existsSync } from "fs";
import { execSync } from "child_process";
import { join } from "path";
import { fileURLToPath } from "url";

const root = join(fileURLToPath(import.meta.url), "..", "..");
if (existsSync(join(root, "src")) && existsSync(join(root, "tsconfig.json"))) {
  execSync("npm run build", { cwd: root, stdio: "inherit" });
}
