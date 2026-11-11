import { writeFile } from "node:fs/promises";
import type { FixPatch } from "../providers/index.js";

export type ApplyResult =
  | { ok: true; content: string; startLine: number }
  | { ok: false; reason: "not-found" | "ambiguous" };

/**
 * Replace `patch.search` with `patch.replace`. The search text must match
 * exactly (whitespace included) and exactly once; otherwise nothing changes.
 * Uses slicing, not String.replace, so `$` sequences in code stay literal.
 */
export function applySearchReplace(
  content: string,
  patch: Pick<FixPatch, "search" | "replace">,
): ApplyResult {
  const index = content.indexOf(patch.search);
  if (index === -1) return { ok: false, reason: "not-found" };
  if (content.indexOf(patch.search, index + 1) !== -1) {
    return { ok: false, reason: "ambiguous" };
  }

  const startLine = content.slice(0, index).split("\n").length;
  const next =
    content.slice(0, index) +
    patch.replace +
    content.slice(index + patch.search.length);
  return { ok: true, content: next, startLine };
}

/** Original file contents captured before the first write, for rollback. */
export class FileSnapshots {
  private readonly originals = new Map<string, string>();

  /** Remember `original` for `absolutePath`; only the first call per file counts. */
  remember(absolutePath: string, original: string): void {
    if (!this.originals.has(absolutePath)) {
      this.originals.set(absolutePath, original);
    }
  }

  get size(): number {
    return this.originals.size;
  }

  /** Write every remembered original back. Git index and stash are untouched. */
  async rollback(): Promise<void> {
    for (const [path, original] of this.originals) {
      await writeFile(path, original, "utf8");
    }
    this.originals.clear();
  }
}
