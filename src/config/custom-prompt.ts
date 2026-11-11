import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getRepoRoot } from "../git/diff.js";

const PROMPT_FILE_NAME = "reviuah-prompt.md";

/**
 * Resolve custom prompt: CLI --prompt > env REVIUAH_CUSTOM_PROMPT > repo root reviuah-prompt.md.
 */
export async function resolveCustomPrompt(
  cliPrompt?: string,
): Promise<string | undefined> {
  const fromCli = cliPrompt?.trim();
  if (fromCli) return fromCli;

  const fromEnv = process.env.REVIUAH_CUSTOM_PROMPT?.trim();
  if (fromEnv) return fromEnv;

  try {
    const root = await getRepoRoot();
    const path = join(root, PROMPT_FILE_NAME);
    const content = await readFile(path, "utf8");
    return content.trim() || undefined;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code === "ENOENT") return undefined;
    throw err;
  }
}
