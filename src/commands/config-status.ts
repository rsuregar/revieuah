import {
  getUserConfigPath,
  maskApiKey,
  readUserConfig,
} from "../config/user-config.js";

export async function configStatusCommand(): Promise<void> {
  const path = getUserConfigPath();
  const cfg = await readUserConfig();

  console.log(`Config file: ${path}`);
  if (!cfg?.apiKey) {
    console.log("API key: (belum diset — jalankan: reviuah setup)");
  } else {
    console.log(`API key: ${maskApiKey(cfg.apiKey)} (tersimpan)`);
  }
  if (cfg?.provider) console.log(`Provider: ${cfg.provider}`);
  if (cfg?.model) console.log(`Model: ${cfg.model}`);
  if (cfg?.providerUrl) console.log(`Base URL: ${cfg.providerUrl}`);
  console.log("\nEnv REVIUAH_API_KEY / REVIUAH_PROVIDER / … mengoverride file ini.");
}
