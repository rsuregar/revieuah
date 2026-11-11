import { resolve } from "node:path";
import { resolveCustomPrompt } from "../config/custom-prompt.js";
import { resolveReviewCredentials } from "../config/user-config.js";
import { reviewAndApply } from "../fix/apply-session.js";
import { loadFileGroups, loadProjectRules } from "../fix/context.js";
import { assertSingleSource, loadFindings } from "../fix/load-findings.js";
import {
  getPathsWithWorktreeChanges,
  stagePaths,
} from "../fix/git-state.js";
import { FileSnapshots } from "../fix/patch-applier.js";
import { collectPatches, formatSeconds, formatUsage } from "../fix/propose.js";
import { resolveVerifyCommand, runVerify } from "../fix/verify.js";
import { ensureGitRepository, getRepoRoot } from "../git/diff.js";
import { createProvider } from "../providers/factory.js";
import { askVerifyFailureChoice, askYesNo } from "../ui/confirm-patch.js";
import { startSpinner } from "../ui/spinner.js";

/** First attempt plus one retry with the verification output as context. */
const MAX_ATTEMPTS = 2;
const MAX_PRINTED_VERIFY_CHARS = 3000;

export interface FixCommandOptions {
  /** Path to a review.json written by `reviuah --per-file --out`. */
  input?: string;
  /** GitLab merge request number; reads unresolved diff threads of origin's project. */
  mr?: string;
  dryRun?: boolean;
  yes?: boolean;
  verify?: string;
  lang: string;
  prompt?: string;
}

function joinPrompts(...parts: Array<string | undefined>): string | undefined {
  const text = parts.filter(Boolean).join("\n\n");
  return text || undefined;
}

async function verifyWithSpinner(command: string, root: string) {
  const stop = startSpinner(`Verifying: ${command}`);
  try {
    return await runVerify(command, root);
  } finally {
    stop();
  }
}

async function offerStaging(
  root: string,
  appliedFiles: string[],
  dirty: Set<string>,
  autoYes: boolean,
): Promise<void> {
  const stageable = appliedFiles.filter((p) => !dirty.has(p));
  const blocked = appliedFiles.filter((p) => dirty.has(p));
  if (blocked.length > 0) {
    console.error(
      `Not staging (you had unstaged changes there): ${blocked.join(", ")}`,
    );
  }
  if (stageable.length === 0) return;
  if (autoYes) {
    console.error(`Not staging automatically. To stage: git add ${stageable.join(" ")}`);
    return;
  }
  if (await askYesNo(`Stage ${stageable.length} patched file(s)?`)) {
    await stagePaths(root, stageable);
    console.error("Staged. Review with `git diff --staged`, then commit.");
  }
}

export async function fixCommand(options: FixCommandOptions): Promise<void> {
  const startedAt = Date.now();
  assertSingleSource(options);
  if (options.mr && options.yes) {
    throw new Error(
      "--yes cannot be combined with --mr: MR comments are untrusted input, so every patch needs your approval.",
    );
  }
  if (!options.dryRun && !options.yes && !process.stdin.isTTY) {
    throw new Error(
      "No TTY for approval prompts. Pass --yes to apply without prompts, or --dry-run to only print diffs.",
    );
  }

  await ensureGitRepository();
  const root = await getRepoRoot();
  const comments = await loadFindings(options, root);
  if (comments.length === 0) {
    console.error("ReviuAh: no actionable comments in the input.");
    return;
  }

  const provider = createProvider(await resolveReviewCredentials());
  if (!provider.fix) {
    throw new Error("The configured provider does not support `fix`.");
  }
  const fixProvider = { fix: provider.fix.bind(provider) };

  const projectRules = await loadProjectRules(root);
  const customPrompt = joinPrompts(
    projectRules && `Project rules (AGENTS.md):\n${projectRules}`,
    await resolveCustomPrompt(options.prompt),
  );

  const verifyCommand = options.dryRun ? undefined : resolveVerifyCommand(options.verify);
  let dirty = new Set<string>();
  let baselineOk = false;
  let verifyFailure: string | undefined;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const { groups, skipped } = await loadFileGroups(root, comments);
    if (attempt === 0) {
      for (const { path, reason } of skipped) {
        console.error(`Skipped ${path}: ${reason}.`);
      }
    }
    if (groups.length === 0) {
      console.error("ReviuAh: nothing to fix.");
      return;
    }

    if (attempt === 0) {
      // Only paths that passed the safety checks may reach git or the verifier.
      dirty = await getPathsWithWorktreeChanges(root, groups.map((g) => g.path));
      if (verifyCommand) {
        baselineOk = (await verifyWithSpinner(verifyCommand, root)).ok;
        if (!baselineOk) {
          console.error(
            "Baseline verification already fails before any patch; results will be marked unverified.",
          );
        }
      }
    }

    const { proposals, usage } = await collectPatches(fixProvider, groups, {
      language: options.lang,
      customPrompt,
      verifyFailure,
    });
    const snapshots = new FileSnapshots();
    const outcome = await reviewAndApply({
      root,
      proposals,
      snapshots,
      dryRun: Boolean(options.dryRun),
      autoApprove: Boolean(options.yes),
    });

    console.error(
      `\n${options.dryRun ? "Dry run: would apply" : "Applied"} ${outcome.appliedCount} patch(es), skipped ${outcome.skippedCount}, comment(s) without a patch ${outcome.unaddressedCount}.`,
    );
    console.error(`Elapsed ${formatSeconds(Date.now() - startedAt)}; ${formatUsage(usage)}.`);
    if (options.dryRun || outcome.appliedFiles.length === 0) return;

    if (!verifyCommand || !baselineOk) {
      console.error(
        verifyCommand
          ? "Unverified (baseline failed). Not offering to stage."
          : "Unverified: set --verify or REVIUAH_FIX_VERIFY_CMD to enable verification and staging.",
      );
      return;
    }

    const verification = await verifyWithSpinner(verifyCommand, root);
    if (verification.ok) {
      console.error("Verification passed.");
      await offerStaging(root, outcome.appliedFiles, dirty, Boolean(options.yes));
      return;
    }

    console.error(verification.output.slice(-MAX_PRINTED_VERIFY_CHARS));
    process.exitCode = 1;
    const canRetry = attempt + 1 < MAX_ATTEMPTS;
    const choice = options.yes ? "rollback" : await askVerifyFailureChoice(canRetry);
    if (choice === "keep") {
      console.error("Changes kept; they failed verification.");
      return;
    }
    await snapshots.rollback();
    console.error("Rolled back all patched files.");
    if (choice !== "retry") return;
    verifyFailure = verification.output;
    process.exitCode = 0;
  }
}
