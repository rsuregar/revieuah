const DEFAULT_MAX_DIFF_SIZE = 120000;
const MIN_MAX_DIFF_SIZE = 1000;
const MAX_MAX_DIFF_SIZE = 500_000;

/** Max characters of diff/file content sent to the LLM (env REVIUAH_MAX_DIFF_SIZE). */
export function getMaxDiffSize(): number {
  const env = process.env.REVIUAH_MAX_DIFF_SIZE?.trim();
  if (!env) return DEFAULT_MAX_DIFF_SIZE;
  const n = parseInt(env, 10);
  if (!Number.isFinite(n) || n < MIN_MAX_DIFF_SIZE) return DEFAULT_MAX_DIFF_SIZE;
  return Math.min(n, MAX_MAX_DIFF_SIZE);
}

/** Extra regexes (comma-separated, env REVIUAH_DIFF_EXCLUDE_PATTERNS) for paths to skip. */
export function getExtraDiffExcludePatterns(): string[] {
  const raw = process.env.REVIUAH_DIFF_EXCLUDE_PATTERNS?.trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}
