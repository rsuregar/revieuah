import { realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";

function isInside(base: string, target: string): boolean {
  const rel = relative(base, target);
  return (
    rel !== "" && rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel)
  );
}

/**
 * Resolve a repo-relative path to an absolute path of an existing file.
 * Rejects absolute paths, `..` escapes, and symlinks that leave the repo root.
 * Throws with an actionable message; ENOENT propagates unchanged.
 */
export async function resolveRepoFile(
  root: string,
  relPath: string,
): Promise<string> {
  if (isAbsolute(relPath)) {
    throw new Error(`Refusing absolute path: ${relPath}`);
  }
  const absolute = resolve(root, relPath);
  if (!isInside(root, absolute)) {
    throw new Error(`Refusing path outside the repository: ${relPath}`);
  }
  const [realFile, realRoot] = await Promise.all([
    realpath(absolute),
    realpath(root),
  ]);
  if (!isInside(realRoot, realFile)) {
    throw new Error(`Refusing symlink that leaves the repository: ${relPath}`);
  }
  return absolute;
}
