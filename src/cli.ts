#!/usr/bin/env node

import { Command } from "commander";
import { reviewCommand } from "./commands/review.js";

const program = new Command();

program
  .name("reviuah")
  .description("AI-powered Git diff reviewer")
  .option("--commit <ref>", "review a specific commit")
  .option("--range <range>", "review a git range, e.g. main...HEAD")
  .option("--strict", "exit with code 1 when risk level is high", false)
  .option("--lang <lang>", "output language", "en")
  .action(async (options: { commit?: string; range?: string; strict?: boolean; lang?: string }) => {
    const result = await reviewCommand({
      commit: options.commit,
      range: options.range,
      strict: Boolean(options.strict),
      lang: options.lang ?? "en"
    });

    if (options.strict && result.risk === "high") {
      process.exitCode = 1;
    }
  });

program.parseAsync(process.argv).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error(`Error: ${message}`);
  process.exitCode = 1;
});
