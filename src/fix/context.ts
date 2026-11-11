import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getExtraDiffExcludePatterns, getMaxDiffSize } from "../config/diff-limits.js";
import { isExcludedFilePath } from "../git/prepare-diff.js";
import type { FileComment } from "../providers/index.js";
import { resolveRepoFile } from "./safe-path.js";

const PROJECT_RULES_FILE = "AGENTS.md";
const MAX_PROJECT_RULES_CHARS = 8000;

export interface FileGroup {
  path: string;
  content: string;
  comments: FileComment[];
}

export interface SkippedFile {
  path: string;
  reason: string;
}

function groupByPath(comments: FileComment[]): Map<string, FileComment[]> {
  const groups = new Map<string, FileComment[]>();
  for (const comment of comments) {
    const list = groups.get(comment.path) ?? [];
    list.push(comment);
    groups.set(comment.path, list);
  }
  return groups;
}

async function readGroup(
  root: string,
  path: string,
  comments: FileComment[],
  maxChars: number,
): Promise<FileGroup | string> {
  if (isExcludedFilePath(path, getExtraDiffExcludePatterns())) {
    return "excluded by the token-budget filters (lockfile, build output, binary, or REVIUAH_DIFF_EXCLUDE_PATTERNS)";
  }
  let absolute: string;
  try {
    absolute = await resolveRepoFile(root, path);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return "file does not exist in the working tree";
    }
    return err instanceof Error ? err.message : String(err);
  }
  const content = await readFile(absolute, "utf8");
  if (content.length > maxChars) {
    return `file is ${content.length} chars, over REVIUAH_MAX_DIFF_SIZE (${maxChars})`;
  }
  return { path, content, comments };
}

/**
 * Read the current working-tree content of every file that has comments.
 * Files that are unsafe, filtered, missing, or over the size budget are
 * reported in `skipped` and never sent to the LLM.
 */
export async function loadFileGroups(
  root: string,
  comments: FileComment[],
): Promise<{ groups: FileGroup[]; skipped: SkippedFile[] }> {
  const maxChars = getMaxDiffSize();
  const groups: FileGroup[] = [];
  const skipped: SkippedFile[] = [];

  for (const [path, fileComments] of groupByPath(comments)) {
    const result = await readGroup(root, path, fileComments, maxChars);
    if (typeof result === "string") skipped.push({ path, reason: result });
    else groups.push(result);
  }
  return { groups, skipped };
}

/** AGENTS.md from the repo root, truncated, or undefined when absent. */
export async function loadProjectRules(root: string): Promise<string | undefined> {
  try {
    const content = await readFile(join(root, PROJECT_RULES_FILE), "utf8");
    return content.trim().slice(0, MAX_PROJECT_RULES_CHARS) || undefined;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw err;
  }
}
