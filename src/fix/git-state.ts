import { execa } from "execa";

/**
 * Paths (of those given) with unstaged or untracked changes. Staging such a
 * file would also stage the developer's unfinished work.
 */
export async function getPathsWithWorktreeChanges(
  root: string,
  paths: string[],
): Promise<Set<string>> {
  const dirty = new Set<string>();
  if (paths.length === 0) return dirty;

  const result = await execa(
    "git",
    ["status", "--porcelain", "-z", "--", ...paths],
    { cwd: root, reject: false },
  );
  if (result.exitCode !== 0) {
    throw new Error(`git status failed: ${result.stderr.trim()}`);
  }
  for (const entry of result.stdout.split("\0")) {
    // "XY path": Y is the worktree column; anything but a space is unstaged/untracked.
    if (entry.length > 3 && entry[1] !== " ") dirty.add(entry.slice(3));
  }
  return dirty;
}

export async function stagePaths(root: string, paths: string[]): Promise<void> {
  const result = await execa("git", ["add", "--", ...paths], {
    cwd: root,
    reject: false,
  });
  if (result.exitCode !== 0) {
    throw new Error(`git add failed: ${result.stderr.trim()}`);
  }
}
