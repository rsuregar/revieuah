import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import {
  getUserConfigPath,
  maskApiKey,
  readUserConfig,
  writeUserConfig,
  type UserConfig,
} from "../config/user-config.js";
import { readSecretLine } from "../lib/read-secret.js";
import { listProviderIds, resolveProviderDefaults } from "../providers/openai.js";
import { SetupWizard } from "../ui/setup-wizard.js";
import { selectBox } from "../ui/select-box.js";

async function question(defaultLabel: string, def?: string): Promise<string> {
  const rl = readline.createInterface({ input, output });
  try {
    const hint = def !== undefined ? `${defaultLabel} [${def}]: ` : `${defaultLabel}: `;
    const line = (await rl.question(hint)).trim();
    return line || def || "";
  } finally {
    rl.close();
  }
}

export async function setupCommand(): Promise<void> {
  const existing = await readUserConfig();
  const path = getUserConfigPath();

  if (input.isTTY && output.isTTY) {
    const saved = await new SetupWizard(existing).run();
    if (saved) {
      console.error("\nSelesai. Coba: reviuah (review staged) atau reviuah --base main");
    }
    return;
  }

  console.error("ReviuAh setup — menyimpan konfigurasi di:");
  console.error(`  ${path}`);
  console.error("(File hanya di komputer kamu; jangan di-commit. Env REVIUAH_* tetap mengoverride.)\n");

  let apiKey: string;

  if (existing?.apiKey) {
    const keep = (
      await question(
        `Pertahankan API key saat ini (${maskApiKey(existing.apiKey)})? ketik y atau n`,
        "y",
      )
    ).toLowerCase();
    if (keep === "n" || keep === "no") {
      apiKey = await readSecretLine("API key baru: ");
      while (!apiKey.trim()) {
        console.error("API key wajib diisi.");
        apiKey = await readSecretLine("API key baru: ");
      }
    } else {
      apiKey = existing.apiKey;
    }
  } else {
    apiKey = await readSecretLine("API key: ");
    while (!apiKey.trim()) {
      console.error("API key wajib diisi.");
      apiKey = await readSecretLine("API key: ");
    }
  }

  const providerIds = listProviderIds();
  const defaultProv = existing?.provider?.trim() || "agentrouter";
  const provider =
    (await selectBox("Pilih provider", providerIds, defaultProv)) ||
    defaultProv;
  const defaults = resolveProviderDefaults(provider);

  const rl2 = readline.createInterface({ input, output });
  let modelLine: string;
  let urlLine: string;
  try {
    modelLine = (
      await rl2.question(
        `Model (Enter = ${defaults.defaultModel}): `,
      )
    ).trim();
    urlLine = (
      await rl2.question(`Base URL (Enter = ${defaults.baseURL}): `)
    ).trim();
  } finally {
    rl2.close();
  }
  const model = modelLine || defaults.defaultModel;
  const providerUrl = urlLine || defaults.baseURL;

  const next: UserConfig = {
    apiKey: apiKey.trim(),
    provider,
    model,
    providerUrl,
  };

  await writeUserConfig(next);
  console.error("\nSelesai. Coba: reviuah (review staged) atau reviuah --base main");
}
