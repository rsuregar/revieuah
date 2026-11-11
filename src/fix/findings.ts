import { readFile } from "node:fs/promises";
import type { FileComment } from "../providers/index.js";

const SEVERITIES: Record<string, true> = {
  critical: true,
  warning: true,
  suggestion: true,
  praise: true,
};

function toComment(item: unknown): FileComment | undefined {
  if (item === null || typeof item !== "object") return undefined;
  const raw = item as Record<string, unknown>;
  if (typeof raw.path !== "string" || !raw.path.trim()) return undefined;
  if (typeof raw.body !== "string" || !raw.body.trim()) return undefined;

  const severity =
    typeof raw.severity === "string" && Object.hasOwn(SEVERITIES, raw.severity)
      ? (raw.severity as FileComment["severity"])
      : "warning";
  if (severity === "praise") return undefined;

  const line = typeof raw.line === "number" ? Math.max(0, Math.floor(raw.line)) : 0;
  return {
    path: raw.path.trim().replace(/^\.\//, ""),
    line,
    body: raw.body.trim(),
    severity,
    ...(typeof raw.suggestionCode === "string" &&
      raw.suggestionCode.trim() && { suggestionCode: raw.suggestionCode.trim() }),
  };
}

/** Extract actionable comments from a parsed PerFileReviewResponse. Praise is dropped. */
export function parseReviewInput(json: unknown): FileComment[] {
  const comments =
    json !== null && typeof json === "object"
      ? (json as { comments?: unknown }).comments
      : undefined;
  if (!Array.isArray(comments)) {
    throw new Error(
      'Input is not a per-file review: missing "comments" array. Create one with: reviuah --per-file --out review.json',
    );
  }
  return comments.flatMap((c) => toComment(c) ?? []);
}

/** Read a review.json produced by `reviuah --per-file --out`. */
export async function loadReviewInput(file: string): Promise<FileComment[]> {
  let text: string;
  try {
    text = await readFile(file, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`Input file not found: ${file}`);
    }
    throw err;
  }
  try {
    return parseReviewInput(JSON.parse(text));
  } catch (err) {
    if (err instanceof SyntaxError) {
      throw new Error(`Input file is not valid JSON: ${file}`);
    }
    throw err;
  }
}
