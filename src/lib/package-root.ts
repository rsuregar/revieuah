import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** Resolves the repo/package root (where package.json lives). Works from dist/commands/ or dist/lib/. */
export function getPackageRoot(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return join(here, "..", "..");
}
