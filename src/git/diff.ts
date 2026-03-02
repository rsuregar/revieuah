import { execa } from "execa";

async function runGitDiff(args: string[]): Promise<string> {
<<<<<<< HEAD
  const result = await execa("git", args, { reject: false });

  if (result.exitCode !== 0) {
    const message = result.stderr.trim() || "Unknown git error";
    throw new Error(`Failed to run git ${args.join(" ")}: ${message}`);
  }

  return result.stdout.trim();
=======
  const { stdout } = await execa("git", args, { reject: false });
  return stdout.trim();
>>>>>>> 4f69b6989e75ca7ed105a107be0fb4540c048ccb
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
