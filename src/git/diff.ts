import { execa } from "execa";

async function runGitDiff(args: string[]): Promise<string> {
  const { stdout } = await execa("git", args, { reject: false });
  return stdout.trim();
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
