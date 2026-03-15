import type { Provider, ProviderCredentials } from "./index.js";
import { OpenAIProvider } from "./openai.js";

/** Returns a Provider instance (OpenAI-compatible for all providers including Gemini). */
export function createProvider(credentials: ProviderCredentials): Provider {
  return new OpenAIProvider(credentials);
}
