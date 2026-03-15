import type { Provider, ProviderCredentials } from "./index.js";
import { OpenAIProvider } from "./openai.js";

/**
 * Returns a Provider instance. Abstracts provider implementation so callers
 * (e.g. reviewCommand) stay decoupled from OpenAIProvider and non-OpenAI
 * providers can be added later.
 */
export function createProvider(credentials: ProviderCredentials): Provider {
  return new OpenAIProvider(credentials);
}
