import { execa } from "execa";
import { buildFixPrompt, parseFixResponse } from "./fix-prompt.js";
import type {
  FixRequest,
  FixResult,
  PerFileReviewResponse,
  Provider,
  ReviewRequest,
  ReviewResponse,
} from "./index.js";
import { buildPerFilePrompt, parsePerFileResponse } from "./per-file-prompt.js";
import { getRequestTimeoutMs } from "./request-timeout.js";
import {
  buildReviewPrompt,
  extractRiskLevel,
  REVIEW_SYSTEM_PROMPT,
} from "./review-prompt.js";

const MAX_PRINTED_STDERR_CHARS = 500;

/**
 * Runs the prompt through a local CLI that handles its own login, e.g.
 * `omp -p --no-tools --no-session`. The prompt goes to stdin and the answer is
 * read from stdout, so ReviuAh never sees or stores the CLI's credentials.
 */
export class CommandProvider implements Provider {
  constructor(private readonly commandLine: string) {}

  async review(request: ReviewRequest): Promise<ReviewResponse> {
    const markdown = await this.run(REVIEW_SYSTEM_PROMPT, buildReviewPrompt(request));
    return { markdown, risk: extractRiskLevel(markdown) };
  }

  async reviewPerFile(request: ReviewRequest): Promise<PerFileReviewResponse> {
    const { system, user } = buildPerFilePrompt(request);
    return parsePerFileResponse(await this.run(system, user));
  }

  async fix(request: FixRequest): Promise<FixResult> {
    const { system, user } = buildFixPrompt(request);
    return { patches: parseFixResponse(await this.run(system, user), request) };
  }

  /** The command is the user's own configuration (env or ~/.reviuah/config.json), so it runs through the shell. */
  private async run(system: string, user: string): Promise<string> {
    const timeoutMs = getRequestTimeoutMs();
    const result = await execa(this.commandLine, {
      shell: true,
      input: `${system}\n\n${user}`,
      timeout: timeoutMs,
      reject: false,
    });
    if (result.timedOut) {
      throw new Error(
        `Command timed out after ${timeoutMs / 1000}s. Set REVIUAH_REQUEST_TIMEOUT_MS to change.`,
      );
    }
    if (result.exitCode !== 0) {
      const detail = result.stderr.trim().slice(-MAX_PRINTED_STDERR_CHARS);
      throw new Error(`Command failed (exit ${result.exitCode ?? "none"}): ${detail || "no error output"}`);
    }
    const output = result.stdout.trim();
    if (!output) throw new Error("Command produced no output.");
    return output;
  }
}
