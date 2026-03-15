import { execa } from "execa";
import {
  prepareDiffForReview,
  splitDiffIntoSections,
  type DiffSection,
  type PreparedDiffResult,
} from "./prepare-diff.js";

export interface GitDiffOptions {
  /** Git unified context lines. Lower values reduce prompt tokens. */
  contextLines?: number;
}

const DEFAULT_CONTEXT_LINES = 3;

function normalizeContextLines(contextLines?: number): number {
  if (!Number.isFinite(contextLines)) return DEFAULT_CONTEXT_LINES;
  return Math.max(0, Math.min(10, Math.floor(contextLines!)));
}

async function runGitDiff(
  args: string[],
  options: GitDiffOptions = {},
): Promise<string> {
  const unified = normalizeContextLines(options.contextLines);
  const result = await execa("git", [...args, `--unified=${unified}`], {
    reject: false,
  });

  if (result.exitCode !== 0) {
    const message = result.stderr.trim() || "Unknown git error";
    throw new Error(`Failed to run git ${args.join(" ")}: ${message}`);
  }

  return result.stdout.trim();
}

export async function getStagedDiff(
  options: GitDiffOptions = {},
): Promise<string> {
  return runGitDiff(["diff", "--cached"], options);
}

export async function getCommitDiff(
  ref: string,
  options: GitDiffOptions = {},
): Promise<string> {
  return runGitDiff(["show", "--format=", ref], options);
}

export async function getRangeDiff(
  range: string,
  options: GitDiffOptions = {},
): Promise<string> {
  return runGitDiff(["diff", range], options);
}

export {
  prepareDiffForReview,
  splitDiffIntoSections,
  type DiffSection,
  type PreparedDiffResult,
};

/** Returns the git repository root (absolute path). Throws if not in a git repo. */
export async function getRepoRoot(): Promise<string> {
  const result = await execa("git", ["rev-parse", "--show-toplevel"], {
    reject: false,
  });
  if (result.exitCode !== 0) {
    throw new Error("Not a git repository.");
  }
  return result.stdout.trim();
}
