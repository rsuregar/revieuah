import { execa } from "execa";
import { getCommitDiff, getRangeDiff, getStagedDiff } from "../git/diff.js";
import { OpenAIProvider, resolveProviderDefaults } from "../providers/openai.js";
import type { ReviewResponse } from "../providers/index.js";

const MAX_DIFF_SIZE = 120000;

export interface ReviewCommandOptions {
  commit?: string;
  range?: string;
  strict: boolean;
  lang: string;
}

export async function reviewCommand(options: ReviewCommandOptions): Promise<ReviewResponse> {
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
      "- Stage or select changes before running ReviuAh."
    ].join("\n");

    console.log(emptyMarkdown);
    return { markdown: emptyMarkdown, risk: "unknown" };
  }

  const trimmedDiff = trimDiff(diff, MAX_DIFF_SIZE);

  const apiKey = process.env.REVIUAH_API_KEY;
  if (!apiKey) {
    throw new Error("Missing REVIUAH_API_KEY environment variable.");
  }

  const providerDefaults = resolveProviderDefaults(process.env.REVIUAH_PROVIDER);

  const provider = new OpenAIProvider({
    apiKey,
    baseURL: process.env.REVIUAH_PROVIDER_URL ?? providerDefaults.baseURL,
    model: process.env.REVIUAH_MODEL ?? providerDefaults.defaultModel
  });

  const result = await provider.review({ diff: trimmedDiff, language: options.lang });
  console.log(result.markdown);

  return result;
}

async function ensureGitRepository(): Promise<void> {
  const check = await execa("git", ["rev-parse", "--is-inside-work-tree"], { reject: false });
  if (check.exitCode !== 0 || check.stdout.trim() !== "true") {
    throw new Error("ReviuAh must be run inside a git repository.");
  }
}

async function resolveDiff(options: ReviewCommandOptions): Promise<string> {
  if (options.commit && options.range) {
    throw new Error("Use either --commit or --range, not both.");
  }

  if (options.commit) {
    return getCommitDiff(options.commit);
  }

  if (options.range) {
    return getRangeDiff(options.range);
  }

  return getStagedDiff();
}

function trimDiff(diff: string, maxSize: number): string {
  if (diff.length <= maxSize) {
    return diff;
  }

  return `${diff.slice(0, maxSize)}\n\n[Diff truncated to ${maxSize} characters]`;
}
