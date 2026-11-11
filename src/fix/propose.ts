import type { FixPatch, FixResult, Provider, TokenUsage } from "../providers/index.js";
import { startSpinner } from "../ui/spinner.js";
import type { FileGroup } from "./context.js";

export interface FileProposal {
  group: FileGroup;
  patches: FixPatch[];
}

export interface ProposeOptions {
  language: string;
  customPrompt?: string;
  /** Verification output from a failed attempt, for the retry. */
  verifyFailure?: string;
}

export interface ProposeResult {
  proposals: FileProposal[];
  /** Summed over every file that reported usage; undefined when none did. */
  usage?: TokenUsage;
}

export function formatSeconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

export function formatUsage(usage: TokenUsage | undefined): string {
  return usage
    ? `${usage.inputTokens} in / ${usage.outputTokens} out tokens`
    : "token usage not reported";
}

function addUsage(total: TokenUsage | undefined, next: TokenUsage | undefined): TokenUsage | undefined {
  if (!next) return total;
  return {
    inputTokens: (total?.inputTokens ?? 0) + next.inputTokens,
    outputTokens: (total?.outputTokens ?? 0) + next.outputTokens,
  };
}

/** One LLM call per file, so file content is never sent twice. */
export async function collectPatches(
  provider: Required<Pick<Provider, "fix">>,
  groups: FileGroup[],
  options: ProposeOptions,
): Promise<ProposeResult> {
  const proposals: FileProposal[] = [];
  let usage: TokenUsage | undefined;
  for (const group of groups) {
    const startedAt = Date.now();
    const stopSpinner = startSpinner(`Fixing ${group.path}`);
    let result: FixResult;
    try {
      result = await provider.fix({
        comments: group.comments,
        files: [{ path: group.path, content: group.content }],
        language: options.language,
        customPrompt: options.customPrompt,
        verifyFailure: options.verifyFailure,
      });
    } finally {
      stopSpinner();
    }
    proposals.push({ group, patches: result.patches });
    usage = addUsage(usage, result.usage);
    console.error(
      `Fixed ${group.path}: ${formatSeconds(Date.now() - startedAt)}, ${formatUsage(result.usage)}`,
    );
  }
  return { proposals, usage };
}
