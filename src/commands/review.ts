import { writeFile, access, mkdir, stat, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { execa } from "execa";
import { getCommitDiff, getRangeDiff, getRepoRoot, getStagedDiff } from "../git/diff.js";
import type { PerFileReviewResponse, ReviewResponse } from "../providers/index.js";
import { createProvider } from "../providers/factory.js";
import { resolveReviewCredentials } from "../config/user-config.js";
import { printBanner } from "../ui/logo.js";
import { startSpinner } from "../ui/spinner.js";

const DEFAULT_MAX_DIFF_SIZE = 120000;

function getMaxDiffSize(): number {
  const env = process.env.REVIUAH_MAX_DIFF_SIZE?.trim();
  if (!env) return DEFAULT_MAX_DIFF_SIZE;
  const n = parseInt(env, 10);
  if (!Number.isFinite(n) || n < 1000) return DEFAULT_MAX_DIFF_SIZE;
  return Math.min(n, 500_000);
}

export interface ReviewCommandOptions {
  commit?: string;
  range?: string;
  /** Base ref vs current HEAD (e.g. main → diff main...HEAD). */
  base?: string;
  strict: boolean;
  lang: string;
  /** Write review markdown to this path instead of only stdout. */
  out?: string;
  /** Per-file mode: output JSON with inline comments instead of a single markdown blob. */
  perFile?: boolean;
  /** Custom instructions for the reviewer (focus areas, style, etc.). */
  customPrompt?: string;
  /** Minimal output (fewer sections, lower token usage). */
  compact?: boolean;
  /** Enable/disable summary markdown review generation. */
  summary?: boolean;
}

export async function reviewCommand(
  options: ReviewCommandOptions,
): Promise<ReviewResponse> {
  await ensureGitRepository();
  if (options.out) {
    await validateOutPath(options.out);
  }

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

  const maxSize = getMaxDiffSize();
  const trimmedDiff = trimDiff(diff, maxSize);

  const credentials = await resolveReviewCredentials();
  const provider = createProvider(credentials);

  const customPrompt = await resolveCustomPrompt(options.customPrompt);
  const compact =
    options.compact === true ||
    (process.env.REVIUAH_COMPACT?.trim() === "1" || process.env.REVIUAH_COMPACT?.trim()?.toLowerCase() === "true");
  const summaryEnabled = resolveSummaryEnabled(options.summary);

  if (!options.perFile && !summaryEnabled) {
    console.error("ReviuAh: summary generation disabled (--no-summary or REVIUAH_ENABLE_SUMMARY=0).");
    return { markdown: "", risk: "unknown" };
  }

  printBanner();
  const stopSpinner = startSpinner("Generating review");

  if (options.perFile && provider.reviewPerFile) {
    let perFileResult: PerFileReviewResponse;
    try {
      perFileResult = await provider.reviewPerFile({
        diff: trimmedDiff,
        language: options.lang,
        customPrompt,
      });
    } finally {
      stopSpinner();
    }

    const json = JSON.stringify(perFileResult, null, 2);
    if (options.out) {
      const absolute = resolve(process.cwd(), options.out);
      const parent = dirname(absolute);
      try { await mkdir(parent, { recursive: true }); } catch { /* ok */ }
      await writeFile(absolute, json, "utf8");
      console.error(`ReviuAh: per-file review written to ${options.out}`);
    } else {
      console.log(json);
    }

    return { markdown: perFileResult.summary, risk: perFileResult.risk };
  }

  let result: ReviewResponse;
  try {
    result = await provider.review({
      diff: trimmedDiff,
      language: options.lang,
      customPrompt,
      compact,
    });
  } finally {
    stopSpinner();
  }

  await outputReview(result.markdown, options.out);

  return result;
}

/**
 * Ensures --out path is valid and writable. Throws with a clear message if not.
 */
async function validateOutPath(outPath: string): Promise<void> {
  const absolute = resolve(process.cwd(), outPath);
  const parent = dirname(absolute);

  try {
    await access(parent, constants.W_OK);
  } catch (err) {
    const code = err && typeof (err as NodeJS.ErrnoException).code === "string"
      ? (err as NodeJS.ErrnoException).code
      : "access denied";
    if (code === "ENOENT") {
      throw new Error(
        `--out path invalid: directory does not exist: ${parent}. Create the directory or choose a different path.`,
      );
    }
    throw new Error(
      `--out path not writable: insufficient permissions for ${parent}. Check path and permissions.`,
    );
  }

  try {
    const st = await stat(absolute);
    if (st.isFile()) {
      await access(absolute, constants.W_OK);
    }
  } catch (err) {
    const code = err && typeof (err as NodeJS.ErrnoException).code === "string"
      ? (err as NodeJS.ErrnoException).code
      : "";
    if (code === "ENOENT") return; /* file doesn't exist yet; parent is writable */
    if (code === "EACCES" || code === "EPERM") {
      throw new Error(
        `--out path not writable: cannot write to existing file ${absolute}. Check permissions.`,
      );
    }
  }
}

async function outputReview(markdown: string, outPath?: string): Promise<void> {
  const hasContent = markdown.trim().length > 0;
  if (outPath) {
    if (!hasContent) {
      console.error(
        "ReviuAh: API returned empty review; no file written. Comment will be skipped in CI. Check provider/model or try again.",
      );
      return;
    }
    const absolute = resolve(process.cwd(), outPath);
    const parent = dirname(absolute);
    try {
      await mkdir(parent, { recursive: true });
    } catch {
      /* already validated; ignore if dir exists */
    }
    await writeFile(absolute, markdown, "utf8");
    console.error(`ReviuAh: review written to ${outPath}`);
  } else {
    console.log(markdown);
  }
}

function resolveSummaryEnabled(cliSummary?: boolean): boolean {
  if (cliSummary === false) return false;
  if (cliSummary === true) return true;

  const env = process.env.REVIUAH_ENABLE_SUMMARY?.trim().toLowerCase();
  if (!env) return true;
  return !(env === "0" || env === "false" || env === "no");
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

const PROMPT_FILE_NAME = "reviuah-prompt.md";

/**
 * Resolve custom prompt: CLI --prompt > env REVIUAH_CUSTOM_PROMPT > repo root reviuah-prompt.md.
 */
async function resolveCustomPrompt(cliPrompt?: string): Promise<string | undefined> {
  const fromCli = cliPrompt?.trim();
  if (fromCli) return fromCli;

  const fromEnv = process.env.REVIUAH_CUSTOM_PROMPT?.trim();
  if (fromEnv) return fromEnv;

  try {
    const root = await getRepoRoot();
    const path = join(root, PROMPT_FILE_NAME);
    const content = await readFile(path, "utf8");
    return content.trim() || undefined;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code === "ENOENT") return undefined;
    throw err;
  }
}
