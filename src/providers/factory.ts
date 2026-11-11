import { CommandProvider } from "./command.js";
import type { CommandCredentials, Provider, ProviderCredentials } from "./index.js";
import { OpenAIProvider } from "./openai.js";

/** Returns a Provider: a local CLI when a command is configured, otherwise OpenAI-compatible (including Gemini). */
export function createProvider(credentials: ProviderCredentials | CommandCredentials): Provider {
  return "command" in credentials
    ? new CommandProvider(credentials.command)
    : new OpenAIProvider(credentials);
}
