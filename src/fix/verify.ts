import { execa } from "execa";

export interface VerifyResult {
  ok: boolean;
  /** Combined stdout + stderr of the command. */
  output: string;
}

/**
 * The verification command comes only from the developer (flag or env),
 * never from LLM output, review.json, or MR comments.
 */
export function resolveVerifyCommand(cliValue?: string): string | undefined {
  return cliValue?.trim() || process.env.REVIUAH_FIX_VERIFY_CMD?.trim() || undefined;
}

export async function runVerify(
  command: string,
  cwd: string,
): Promise<VerifyResult> {
  const result = await execa(command, {
    cwd,
    shell: true,
    all: true,
    reject: false,
  });
  return { ok: result.exitCode === 0, output: result.all ?? "" };
}
