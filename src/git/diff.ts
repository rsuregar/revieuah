import { execa } from "execa";

export interface GitDiffOptions {
  /** Git unified context lines. Lower values reduce prompt tokens. */
  contextLines?: number;
}

export interface DiffSection {
  path: string;
  text: string;
}

export interface PreparedDiffResult {
  diff: string;
  keptFiles: string[];
  skippedFiles: string[];
  truncated: boolean;
  originalLength: number;
  finalLength: number;
}

const DEFAULT_CONTEXT_LINES = 3;

const NOISY_DIFF_PATTERNS = [
  /(^|\/)package-lock\.json$/i,
  /(^|\/)yarn\.lock$/i,
  /(^|\/)pnpm-lock\.ya?ml$/i,
  /(^|\/)bun\.lockb?$/i,
  /(^|\/)composer\.lock$/i,
  /(^|\/)cargo\.lock$/i,
  /(^|\/)go\.sum$/i,
  /(^|\/)poetry\.lock$/i,
  /(^|\/)pipfile\.lock$/i,
  /(^|\/)gemfile\.lock$/i,
  /(^|\/)pubspec\.lock$/i,
  /(^|\/)coverage\/?/i,
  /(^|\/)dist\/?/i,
  /(^|\/)build\/?/i,
  /(^|\/)target\/?/i,
  /(^|\/)vendor\/?/i,
  /\.min\.(js|css)$/i,
  /\.(png|jpe?g|gif|webp|bmp|ico|pdf|zip|gz|mp4|mov|woff2?|ttf|eot)$/i,
];

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

function isNoisyDiffPath(path: string): boolean {
  return NOISY_DIFF_PATTERNS.some((pattern) => pattern.test(path));
}

function extractDiffPath(section: string): string {
  const header = section.match(/^diff --git a\/(.+?) b\/(.+)$/m);
  if (header?.[2]) return header[2].trim();

  const plusPlus = section.match(/^\+\+\+ b\/(.+)$/m);
  if (plusPlus?.[1]) return plusPlus[1].trim();

  const minusMinus = section.match(/^--- a\/(.+)$/m);
  if (minusMinus?.[1]) return minusMinus[1].trim();

  return "unknown";
}

export function splitDiffIntoSections(diff: string): DiffSection[] {
  const trimmed = diff.trim();
  if (!trimmed) return [];

  const rawSections = trimmed
    .split(/^diff --git /m)
    .filter(Boolean)
    .map((part) => `diff --git ${part}`.trim());

  return rawSections.map((text) => ({
    path: extractDiffPath(text),
    text,
  }));
}

function buildSkippedFilesNote(skippedFiles: string[]): string {
  if (skippedFiles.length === 0) return "";

  const preview = skippedFiles.slice(0, 12).map((file) => `- ${file}`);
  const remaining = skippedFiles.length - preview.length;

  const lines = [
    "[ReviuAh filtered token-heavy files before sending the diff]",
    ...preview,
  ];

  if (remaining > 0) {
    lines.push(`- ...and ${remaining} more filtered file(s)`);
  }

  return `${lines.join("\n")}\n\n`;
}

function buildTruncationNote(
  maxSize: number,
  keptFiles: string[],
  skippedFiles: string[],
): string {
  const lines = [
    `[Diff truncated to stay within ${maxSize} characters]`,
    `Included file sections: ${keptFiles.length}`,
  ];

  if (skippedFiles.length > 0) {
    lines.push(`Filtered token-heavy files: ${skippedFiles.length}`);
  }

  return `${lines.join("\n")}\n\n`;
}

export function prepareDiffForReview(
  diff: string,
  maxSize: number,
): PreparedDiffResult {
  const originalLength = diff.length;
  const sections = splitDiffIntoSections(diff);

  if (sections.length === 0) {
    const empty =
      diff.length <= maxSize
        ? diff
        : `${diff.slice(0, maxSize)}\n\n[Diff truncated to stay within size limit]`;
    return {
      diff: empty,
      keptFiles: [],
      skippedFiles: [],
      truncated: diff.length > maxSize,
      originalLength,
      finalLength: empty.length,
    };
  }

  const keptSections: DiffSection[] = [];
  const keptFiles: string[] = [];
  const skippedFiles: string[] = [];

  for (const section of sections) {
    if (isNoisyDiffPath(section.path)) {
      skippedFiles.push(section.path);
      continue;
    }
    keptSections.push(section);
    keptFiles.push(section.path);
  }

  const skippedNote = buildSkippedFilesNote(skippedFiles);
  const fullKeptDiff = keptSections.map((section) => section.text).join("\n\n");
  const fullCandidate = `${skippedNote}${fullKeptDiff}`.trim();

  if (fullCandidate.length <= maxSize) {
    return {
      diff: fullCandidate,
      keptFiles,
      skippedFiles,
      truncated: false,
      originalLength,
      finalLength: fullCandidate.length,
    };
  }

  const truncationNote = buildTruncationNote(maxSize, keptFiles, skippedFiles);
  const prefix = `${skippedNote}${truncationNote}`;
  const selectedSections: DiffSection[] = [];
  const selectedFiles: string[] = [];
  let current = prefix;

  for (const section of keptSections) {
    const candidate =
      selectedSections.length === 0
        ? `${prefix}${section.text}`
        : `${current}\n\n${section.text}`;

    if (candidate.length > maxSize) {
      break;
    }

    selectedSections.push(section);
    selectedFiles.push(section.path);
    current = candidate;
  }

  if (selectedSections.length === 0 && keptSections.length > 0) {
    const first = keptSections[0].text.slice(
      0,
      Math.max(0, maxSize - prefix.length),
    );
    current = `${prefix}${first}`.trimEnd();
  }

  const finalDiff = current.trim();

  return {
    diff: finalDiff,
    keptFiles: selectedFiles,
    skippedFiles,
    truncated: true,
    originalLength,
    finalLength: finalDiff.length,
  };
}

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
