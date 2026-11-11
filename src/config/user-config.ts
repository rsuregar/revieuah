import { mkdir, readFile, writeFile, chmod } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { CommandCredentials, ProviderCredentials } from "../providers/index.js";
import { resolveProviderDefaults } from "../providers/openai.js";

export interface UserConfig {
  apiKey?: string;
  provider?: string;
  providerUrl?: string;
  model?: string;
  /** Shell command for provider "command", e.g. `omp -p --no-tools --no-session`. */
  command?: string;
}

const CONFIG_DIR = join(homedir(), ".reviuah");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");

export function getUserConfigPath(): string {
  return CONFIG_FILE;
}

export async function readUserConfig(): Promise<UserConfig | null> {
  try {
    const raw = await readFile(CONFIG_FILE, "utf8");
    return JSON.parse(raw) as UserConfig;
  } catch {
    return null;
  }
}

export async function writeUserConfig(config: UserConfig): Promise<void> {
  await mkdir(CONFIG_DIR, { recursive: true, mode: 0o700 });
  const body = `${JSON.stringify(config, null, 2)}\n`;
  await writeFile(CONFIG_FILE, body, { mode: 0o600 });
  try {
    await chmod(CONFIG_FILE, 0o600);
  } catch {
    /* Windows may ignore */
  }
}

export function maskApiKey(key: string): string {
  if (key.length <= 8) return "****";
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}

/** Provider name that runs a local CLI instead of calling an HTTP API. */
export const COMMAND_PROVIDER = "command";

/** Env wins over file (CI-friendly). */
export async function resolveReviewCredentials(): Promise<ProviderCredentials | CommandCredentials> {
  const file = await readUserConfig();

  const providerName =
    process.env.REVIUAH_PROVIDER?.trim() || file?.provider?.trim();

  if (providerName?.toLowerCase() === COMMAND_PROVIDER) {
    const command = process.env.REVIUAH_COMMAND?.trim() || file?.command?.trim();
    if (!command) {
      throw new Error(
        "Provider 'command' needs a command. Set REVIUAH_COMMAND, e.g. REVIUAH_COMMAND=\"omp -p --no-tools --no-session\".",
      );
    }
    return { command };
  }

  const apiKey = process.env.REVIUAH_API_KEY?.trim() || file?.apiKey?.trim();
  if (!apiKey) {
    throw new Error(
      "No API key. Run: reviuah setup\nOr set REVIUAH_API_KEY in your environment.",
    );
  }

  const defaults = resolveProviderDefaults(providerName);

  const baseURL =
    process.env.REVIUAH_PROVIDER_URL?.trim() ||
    file?.providerUrl?.trim() ||
    defaults.baseURL;
  const model =
    process.env.REVIUAH_MODEL?.trim() ||
    file?.model?.trim() ||
    defaults.defaultModel;

  return { apiKey, baseURL, model };
}
