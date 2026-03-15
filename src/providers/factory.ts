import type { Provider, ProviderCredentials } from "./index.js";
import { GeminiNativeProvider } from "./gemini-native.js";
import { OpenAIProvider } from "./openai.js";

/**
 * Returns a Provider instance. Uses Gemini native generateContent when
 * baseURL contains "generateContent"; otherwise uses OpenAI-compatible provider.
 */
export function createProvider(credentials: ProviderCredentials): Provider {
  const url = credentials.baseURL.trim();
  if (url.includes("generateContent")) {
    return new GeminiNativeProvider({
      generateContentUrl: url,
      apiKey: credentials.apiKey,
    });
  }
  return new OpenAIProvider(credentials);
}
