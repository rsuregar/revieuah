import { execa } from "execa";

async function runGitDiff(args: string[]): Promise<string> {
  const result = await execa("git", args, { reject: false });

  if (result.exitCode !== 0) {
    const message = result.stderr.trim() || "Unknown git error";
    throw new Error(`Failed to run git ${args.join(" ")}: ${message}`);
  }

  return result.stdout.trim();
}

export async function getStagedDiff(): Promise<string> {
  return runGitDiff(["diff", "--cached"]);
}

export async function getCommitDiff(ref: string): Promise<string> {
  return runGitDiff(["show", "--format=", ref]);
}

export async function getRangeDiff(range: string): Promise<string> {
  return runGitDiff(["diff", range]);
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
