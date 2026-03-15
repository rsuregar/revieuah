import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Root of the reviuah package (where dist/ and package.json live).
 * When run as global CLI this is e.g. .../node_modules/reviuah; when run from repo it's the repo root.
 */
function getPackageRoot(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return join(here, "..");
}

export async function updateCommand(): Promise<void> {
  const root = getPackageRoot();
  const pkgPath = join(root, "package.json");

  if (!existsSync(pkgPath)) {
    console.error("Tidak menemukan package.json. Jalankan dari folder project reviuah.");
    return;
  }

  let pkg: { name?: string; scripts?: { build?: string } };
  try {
    pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  } catch {
    console.error("Gagal baca package.json.");
    return;
  }

  if (pkg.name !== "reviuah" || !pkg.scripts?.build) {
    console.error("Ini bukan project reviuah atau tidak ada script build.");
    return;
  }

  const useYarn = existsSync(join(root, "yarn.lock"));

  console.error("Memperbarui dependensi...");
  try {
    if (useYarn) {
      execSync("yarn install", { cwd: root, stdio: "inherit" });
    } else {
      execSync("npm install", { cwd: root, stdio: "inherit" });
    }
  } catch (err) {
    console.error("Gagal install:", err);
    return;
  }

  console.error("Build ulang...");
  try {
    if (useYarn) {
      execSync("yarn build", { cwd: root, stdio: "inherit" });
    } else {
      execSync("npm run build", { cwd: root, stdio: "inherit" });
    }
  } catch (err) {
    console.error("Gagal build:", err);
    return;
  }

  console.error("Selesai: dependensi diperbarui dan build berhasil.");
}
