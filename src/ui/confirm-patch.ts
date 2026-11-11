import { createInterface } from "node:readline/promises";

export type PatchDecision = "yes" | "no" | "all" | "quit";
export type VerifyFailureChoice = "rollback" | "retry" | "keep";

const PATCH_DECISIONS: Record<string, PatchDecision> = {
  y: "yes",
  yes: "yes",
  a: "all",
  all: "all",
  q: "quit",
  quit: "quit",
};

const VERIFY_CHOICES: Record<string, VerifyFailureChoice> = {
  r: "rollback",
  rollback: "rollback",
  t: "retry",
  retry: "retry",
  k: "keep",
  keep: "keep",
};

/** Anything unrecognised (including empty input) means "no": the safe default. */
export function parsePatchDecision(answer: string): PatchDecision {
  return PATCH_DECISIONS[answer.trim().toLowerCase()] ?? "no";
}

/** Anything unrecognised (including empty input) means rollback: the safe default. */
export function parseVerifyChoice(answer: string): VerifyFailureChoice {
  return VERIFY_CHOICES[answer.trim().toLowerCase()] ?? "rollback";
}

/** Number of leading lines shared by both arrays. */
function commonPrefixLength(a: string[], b: string[]): number {
  let n = 0;
  while (n < a.length && n < b.length && a[n] === b[n]) n++;
  return n;
}

/** Number of trailing lines shared by both arrays, outside the first `skip` lines. */
function commonSuffixLength(a: string[], b: string[], skip: number): number {
  let n = 0;
  while (
    n < a.length - skip &&
    n < b.length - skip &&
    a[a.length - 1 - n] === b[b.length - 1 - n]
  ) {
    n++;
  }
  return n;
}

/**
 * Unified-diff style view of one search/replace edit. `startLine` is 1-based.
 * Lines the search and replace blocks share at either end are left out, so only
 * the lines that actually change are shown.
 */
export function renderPatchDiff(
  path: string,
  startLine: number,
  search: string,
  replace: string,
): string {
  // A trailing newline ends the last line; it is not an extra empty line.
  const before = search.replace(/\n$/, "").split("\n");
  const after = replace.replace(/\n$/, "").split("\n");
  const prefix = commonPrefixLength(before, after);
  const suffix = commonSuffixLength(before, after, prefix);
  const removed = before.slice(prefix, before.length - suffix);
  const added = after.slice(prefix, after.length - suffix);
  return [
    `--- a/${path}`,
    `+++ b/${path}`,
    `@@ -${startLine + prefix},${removed.length} +${startLine + prefix},${added.length} @@`,
    ...removed.map((line) => `-${line}`),
    ...added.map((line) => `+${line}`),
  ].join("\n");
}

/** Prompt on stderr so stdout stays reserved for diffs. */
async function ask(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  try {
    return await rl.question(question);
  } finally {
    rl.close();
  }
}

export async function askPatchDecision(): Promise<PatchDecision> {
  return parsePatchDecision(await ask("Apply? [y]es / [n]o / [a]ll / [q]uit: "));
}

export async function askYesNo(question: string): Promise<boolean> {
  return parsePatchDecision(await ask(`${question} [y/N]: `)) === "yes";
}

export async function askVerifyFailureChoice(
  canRetry: boolean,
): Promise<VerifyFailureChoice> {
  const options = canRetry
    ? "[r]ollback (default) / [t]ry again / [k]eep changes"
    : "[r]ollback (default) / [k]eep changes";
  const choice = parseVerifyChoice(await ask(`Verification failed. ${options}: `));
  return choice === "retry" && !canRetry ? "rollback" : choice;
}
