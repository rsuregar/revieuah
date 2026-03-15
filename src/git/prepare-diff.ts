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
  estimatedInputTokens: number;
}

export interface PrepareDiffOptions {
  maxSize: number;
  extraExcludePatterns?: string[];
}

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
  /(^|\/)\.pnp\.(cjs|js)$/i,
  /(^|\/)coverage\/?/i,
  /(^|\/)dist\/?/i,
  /(^|\/)build\/?/i,
  /(^|\/)target\/?/i,
  /(^|\/)vendor\/?/i,
  /(^|\/)\.next\/?/i,
  /(^|\/)out\/?/i,
  /\.min\.(js|css)$/i,
  /\.(png|jpe?g|gif|webp|bmp|ico|pdf|zip|gz|mp4|mov|woff2?|ttf|eot)$/i,
];

const LOW_SIGNAL_PATH_PATTERNS = [
  /^docs?\//i,
  /(^|\/)README(\.[a-z0-9]+)?$/i,
  /(^|\/)CHANGELOG(\.[a-z0-9]+)?$/i,
  /\.(md|mdx|txt|rst)$/i,
  /\.(json|ya?ml|toml)$/i,
];

function compileExtraPatterns(patterns: string[] = []): RegExp[] {
  const compiled: RegExp[] = [];

  for (const raw of patterns) {
    const value = raw.trim();
    if (!value) continue;

    try {
      compiled.push(new RegExp(value, "i"));
    } catch {
      /* ignore invalid user-supplied regex */
    }
  }

  return compiled;
}

function isExcludedPath(path: string, extraPatterns: RegExp[]): boolean {
  return (
    NOISY_DIFF_PATTERNS.some((pattern) => pattern.test(path)) ||
    extraPatterns.some((pattern) => pattern.test(path))
  );
}

function isLowSignalPath(path: string): boolean {
  return LOW_SIGNAL_PATH_PATTERNS.some((pattern) => pattern.test(path));
}

function scoreSection(path: string, text: string): number {
  let score = 0;

  if (!isLowSignalPath(path)) score += 100;
  if (/\.(ts|tsx|js|jsx|mjs|cjs|py|rb|go|rs|java|kt|swift|cs|php|scala)$/i.test(path)) {
    score += 80;
  }
  if (/\.(sql|sh|bash|zsh|ps1|env|graphql)$/i.test(path)) {
    score += 50;
  }
  if (/\/src\//i.test(path) || /^src\//i.test(path)) score += 40;
  if (/\/test(s)?\//i.test(path) || /\.(test|spec)\./i.test(path)) score += 20;
  if (isLowSignalPath(path)) score -= 40;

  score -= Math.floor(text.length / 4000);

  return score;
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

export function estimateTokenCount(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
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

function selectSectionsWithinBudget(
  sections: DiffSection[],
  prefix: string,
  maxSize: number,
): { text: string; files: string[] } {
  const selected: DiffSection[] = [];
  const files: string[] = [];
  let current = prefix;

  for (const section of sections) {
    const candidate =
      selected.length === 0
        ? `${prefix}${section.text}`
        : `${current}\n\n${section.text}`;

    if (candidate.length > maxSize) {
      continue;
    }

    selected.push(section);
    files.push(section.path);
    current = candidate;
  }

  if (selected.length === 0 && sections.length > 0) {
    const first = sections[0].text.slice(0, Math.max(0, maxSize - prefix.length));
    current = `${prefix}${first}`.trimEnd();
  }

  return {
    text: current.trim(),
    files,
  };
}

export function prepareDiffForReview(
  diff: string,
  options: PrepareDiffOptions,
): PreparedDiffResult {
  const { maxSize, extraExcludePatterns = [] } = options;
  const originalLength = diff.length;
  const sections = splitDiffIntoSections(diff);
  const extraPatterns = compileExtraPatterns(extraExcludePatterns);

  if (sections.length === 0) {
    const finalDiff =
      diff.length <= maxSize
        ? diff
        : `${diff.slice(0, maxSize)}\n\n[Diff truncated to stay within size limit]`;

    return {
      diff: finalDiff,
      keptFiles: [],
      skippedFiles: [],
      truncated: diff.length > maxSize,
      originalLength,
      finalLength: finalDiff.length,
      estimatedInputTokens: estimateTokenCount(finalDiff),
    };
  }

  const keptSections: DiffSection[] = [];
  const skippedFiles: string[] = [];

  for (const section of sections) {
    if (isExcludedPath(section.path, extraPatterns)) {
      skippedFiles.push(section.path);
      continue;
    }
    keptSections.push(section);
  }

  const prioritizedSections = [...keptSections].sort((a, b) => {
    const scoreDiff = scoreSection(b.path, b.text) - scoreSection(a.path, a.text);
    if (scoreDiff !== 0) return scoreDiff;
    return a.path.localeCompare(b.path);
  });

  const skippedNote = buildSkippedFilesNote(skippedFiles);
  const fullKeptDiff = prioritizedSections.map((section) => section.text).join("\n\n");
  const fullCandidate = `${skippedNote}${fullKeptDiff}`.trim();

  if (fullCandidate.length <= maxSize) {
    const keptFiles = prioritizedSections.map((section) => section.path);
    return {
      diff: fullCandidate,
      keptFiles,
      skippedFiles,
      truncated: false,
      originalLength,
      finalLength: fullCandidate.length,
      estimatedInputTokens: estimateTokenCount(fullCandidate),
    };
  }

  const truncationNote = buildTruncationNote(
    maxSize,
    prioritizedSections.map((section) => section.path),
    skippedFiles,
  );
  const prefix = `${skippedNote}${truncationNote}`;
  const selected = selectSectionsWithinBudget(prioritizedSections, prefix, maxSize);

  return {
    diff: selected.text,
    keptFiles: selected.files,
    skippedFiles,
    truncated: true,
    originalLength,
    finalLength: selected.text.length,
    estimatedInputTokens: estimateTokenCount(selected.text),
  };
}
