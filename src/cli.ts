#!/usr/bin/env node

import { Command } from "commander";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { reviewCommand } from "./commands/review.js";
import { setupCommand } from "./commands/setup.js";
import { configStatusCommand } from "./commands/config-status.js";
import { updateCommand } from "./commands/update.js";
import { versionBumpCommand } from "./commands/version-bump.js";
import { checkForUpdates } from "./lib/check-update.js";

function readPkgVersion(): string {
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    const pkgPath = join(here, "..", "package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
      version?: string;
    };
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

const program = new Command();

program
  .name("reviuah")
  .description(
    "AI code review from Git diff (default: staged changes — same diff source idea as commitah, output is review not commit msg)",
  )
  .version(readPkgVersion());

program
  .command("setup")
  .description(
    "Interactive: simpan API key & provider ke ~/.reviuah/config.json (dipakai jika env tidak diset)",
  )
  .action(async () => {
    await setupCommand();
  });

program
  .command("config")
  .description("Tampilkan lokasi file config dan status API key")
  .action(async () => {
    await configStatusCommand();
  });

program
  .command("update")
  .description("Update dependensi lalu build ulang (untuk development / setelah pull)")
  .action(async () => {
    await updateCommand();
  });

program
  .command("version <type>", { hidden: false })
  .description("Bump version: patch (bugfix), minor (fitur baru), major (breaking)")
  .action(async (type: string) => {
    const t = type?.toLowerCase();
    if (t !== "patch" && t !== "minor" && t !== "major") {
      console.error("Pakai: reviuah version patch | minor | major");
      process.exitCode = 1;
      return;
    }
    await versionBumpCommand(t as "patch" | "minor" | "major");
  });

program
  .option("--commit <ref>", "review a specific commit")
  .option("--range <range>", "review a git range, e.g. main...HEAD or origin/main...HEAD")
  .option(
    "--base <ref>",
    "review current branch vs base (same as --range <ref>...HEAD), e.g. main or origin/main",
  )
  .option("--strict", "exit with code 1 when risk level is high", false)
  .option("--lang <lang>", "output language", "en")
  .option("--out <file>", "write review markdown to file")
  .option("--per-file", "output per-file inline comments as JSON (for CI integration)", false)
  .action(
    async (options: {
      commit?: string;
      range?: string;
      base?: string;
      strict?: boolean;
      lang?: string;
      out?: string;
      perFile?: boolean;
    }) => {
      const result = await reviewCommand({
        commit: options.commit,
        range: options.range,
        base: options.base,
        strict: Boolean(options.strict),
        lang: options.lang ?? "en",
        out: options.out,
        perFile: Boolean(options.perFile),
      });

      if (options.strict && result.risk === "high") {
        process.exitCode = 1;
      }

      await checkForUpdates();
    },
  );

program.parseAsync(process.argv).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error(`Error: ${message}`);
  process.exitCode = 1;
});
