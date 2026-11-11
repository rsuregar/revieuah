import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  askPatchDecision,
  renderPatchDiff,
} from "../ui/confirm-patch.js";
import { applySearchReplace, type FileSnapshots } from "./patch-applier.js";
import type { FileProposal } from "./propose.js";

export interface ApplyOptions {
  root: string;
  proposals: FileProposal[];
  snapshots: FileSnapshots;
  /** Print diffs only; write nothing. */
  dryRun: boolean;
  /** Apply every valid patch without prompting. */
  autoApprove: boolean;
}

export interface ApplyOutcome {
  /** Repo-relative paths that were written (unique). */
  appliedFiles: string[];
  appliedCount: number;
  skippedCount: number;
  /** Comments for which the model proposed no patch at all. */
  unaddressedCount: number;
}

const SKIP_REASONS = {
  "not-found": "search text not found in the file",
  ambiguous: "search text matches more than once",
} as const;

/** Name every comment that no patch cites; the model may have judged it not worth fixing. */
function reportUnaddressed({ group, patches }: FileProposal): number {
  const cited = new Set(patches.map((p) => p.commentIndex));
  let count = 0;
  group.comments.forEach((comment, i) => {
    if (cited.has(i)) return;
    count++;
    console.error(
      `\nNo patch proposed for ${group.path}:${comment.line}\n  ${comment.body}`,
    );
  });
  return count;
}

/**
 * Show each patch as a diff and apply it on approval. Patches for one file
 * apply in order against the updated content. Diffs go to stdout; status and
 * prompts go to stderr.
 */
export async function reviewAndApply(options: ApplyOptions): Promise<ApplyOutcome> {
  const total = options.proposals.reduce((n, p) => n + p.patches.length, 0);
  const applied = new Set<string>();
  let appliedCount = 0;
  let skippedCount = 0;
  let unaddressedCount = 0;
  let index = 0;
  let approveAll = options.autoApprove || options.dryRun;

  for (const proposal of options.proposals) {
    const { group, patches } = proposal;
    unaddressedCount += reportUnaddressed(proposal);
    let content = group.content;
    for (const patch of patches) {
      index++;
      const comment = group.comments[patch.commentIndex]!;
      console.error(
        `\n[${index}/${total}] ${group.path}:${comment.line}  (${comment.severity})\n  ${comment.body}`,
      );
      if (patch.explanation) console.error(`  Fix: ${patch.explanation}`);

      const result = applySearchReplace(content, patch);
      if (!result.ok) {
        skippedCount++;
        console.error(`  Skipped: ${SKIP_REASONS[result.reason]}.`);
        continue;
      }
      console.log(renderPatchDiff(group.path, result.startLine, patch.search, patch.replace));

      if (!approveAll) {
        const decision = await askPatchDecision();
        if (decision === "quit") {
          return {
            appliedFiles: [...applied],
            appliedCount,
            skippedCount: skippedCount + (total - index + 1),
            unaddressedCount,
          };
        }
        if (decision === "no") {
          skippedCount++;
          continue;
        }
        if (decision === "all") approveAll = true;
      }

      content = result.content;
      appliedCount++;
      if (options.dryRun) continue;

      const absolute = join(options.root, group.path);
      options.snapshots.remember(absolute, group.content);
      await writeFile(absolute, content, "utf8");
      applied.add(group.path);
      console.error(`  Patched ${group.path}`);
    }
  }
  return { appliedFiles: [...applied], appliedCount, skippedCount, unaddressedCount };
}
