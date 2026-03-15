import { writeFile } from "node:fs/promises";
import { execa } from "execa";
import { getCommitDiff, getRangeDiff, getStagedDiff } from "../git/diff.js";
import { OpenAIProvider } from "../providers/openai.js";
import type { ReviewResponse } from "../providers/index.js";
import { resolveReviewCredentials } from "../config/user-config.js";

const MAX_DIFF_SIZE = 120000;

export interface ReviewCommandOptions {
  commit?: string;
  range?: string;
  /** Base ref vs current HEAD (e.g. main → diff main...HEAD). */
  base?: string;
  strict: boolean;
  lang: string;
  /** Write review markdown to this path instead of only stdout. */
  out?: string;
}

export async function reviewCommand(
  options: ReviewCommandOptions,
): Promise<ReviewResponse> {
  await ensureGitRepository();

  const diff = await resolveDiff(options);

  if (!diff) {
    const emptyMarkdown = [
      "## Summary",
      "No changes detected in the selected diff scope.",
      "",
      "## Risk Level",
      "Unknown",
      "Reason: No diff content to review.",
      "",
      "## Security Review",
      "No changes to analyze.",
      "",
      "## Performance Review",
      "No changes to analyze.",
      "",
      "## Testing Suggestions",
      "No testing required.",
      "",
      "## Code Quality & Maintainability",
      "No changes to assess.",
      "",
      "## Actionable Suggestions",
      "- Stage or select changes before running ReviuAh.",
    ].join("\n");

    await outputReview(emptyMarkdown, options.out);
    return { markdown: emptyMarkdown, risk: "unknown" };
  }

  const trimmedDiff = trimDiff(diff, MAX_DIFF_SIZE);

  const { apiKey, baseURL, model } = await resolveReviewCredentials();

  const provider = new OpenAIProvider({
    apiKey,
    baseURL,
    model,
  });

  const result = await provider.review({
    diff: trimmedDiff,
    language: options.lang,
  });

  await outputReview(result.markdown, options.out);

  return result;
}

async function outputReview(markdown: string, outPath?: string): Promise<void> {
  if (outPath) {
    await writeFile(outPath, markdown, "utf8");
    console.error(`ReviuAh: review written to ${outPath}`);
  } else {
    console.log(markdown);
  }
}

async function ensureGitRepository(): Promise<void> {
  const check = await execa("git", ["rev-parse", "--is-inside-work-tree"], {
    reject: false,
  });
  if (check.exitCode !== 0 || check.stdout.trim() !== "true") {
    throw new Error("ReviuAh must be run inside a git repository.");
  }
}

async function resolveDiff(options: ReviewCommandOptions): Promise<string> {
  const modes = [
    Boolean(options.commit),
    Boolean(options.range),
    Boolean(options.base),
  ].filter(Boolean).length;
  if (modes > 1) {
    throw new Error(
      "Use only one of: default (staged), --commit, --range, or --base.",
    );
  }

  if (options.commit) {
    return getCommitDiff(options.commit);
  }

  if (options.range) {
    return getRangeDiff(options.range);
  }

  if (options.base) {
    return getRangeDiff(`${options.base}...HEAD`);
  }

  return getStagedDiff();
}

function trimDiff(diff: string, maxSize: number): string {
  if (diff.length <= maxSize) {
    return diff;
  }

  return `${diff.slice(0, maxSize)}\n\n[Diff truncated to ${maxSize} characters]`;
}
