import OpenAI from "openai";
import type {
  FixRequest,
  FixResult,
  PerFileReviewResponse,
  Provider,
  ReviewRequest,
  ReviewResponse,
  TokenUsage,
} from "./index.js";
import { buildFixPrompt, parseFixResponse } from "./fix-prompt.js";
import { buildPerFilePrompt, parsePerFileResponse } from "./per-file-prompt.js";
import { getRequestTimeoutMs } from "./request-timeout.js";
import {
  buildReviewPrompt,
  extractRiskLevel,
  REVIEW_SYSTEM_PROMPT,
} from "./review-prompt.js";

interface JsonCompletion {
  text: string;
  usage?: TokenUsage;
}

const RATE_LIMIT_HINT =
  " Try again later. You can use a different provider (REVIUAH_PROVIDER) or model, or reduce the diff size.";

function messageForStatus(status: number): string {
  switch (status) {
    case 401: return "Authentication failed (401). Check your API key.";
    case 403: return "Forbidden (403). API key does not have access.";
    case 404: return "Not found (404). Check model name or endpoint URL.";
    case 429:
      return "Rate limit exceeded (429)." + RATE_LIMIT_HINT;
    default: return `Request failed (${status}).`;
  }
}

function isRateLimitError(err: unknown): boolean {
  const status = (err as { status?: number })?.status;
  if (status === 429) return true;
  const msg = err instanceof Error ? err.message : String(err);
  return /rate\s*limit|limit\s*exceeded/i.test(msg);
}

function messageForRateLimit(err: unknown): string {
  const status = (err as { status?: number })?.status;
  const base = typeof status === "number" ? `Rate limit exceeded (${status}).` : "Rate limit exceeded.";
  return base + RATE_LIMIT_HINT;
}

/** Optional max completion tokens (env REVIUAH_MAX_OUTPUT_TOKENS). Cap output to reduce token usage. */
function getMaxOutputTokens(): number | undefined {
  const env = process.env.REVIUAH_MAX_OUTPUT_TOKENS?.trim();
  if (!env) return undefined;
  const n = parseInt(env, 10);
  if (!Number.isFinite(n) || n < 100) return undefined;
  return Math.min(n, 16000);
}

export interface OpenAIProviderOptions {
  apiKey: string;
  baseURL?: string;
  model: string;
}

interface ProviderTemplate {
  baseURL: string;
  defaultModel: string;
}

const PROVIDER_TEMPLATES: Record<string, ProviderTemplate> = {
  openai: { baseURL: "https://api.openai.com/v1", defaultModel: "gpt-4o" },
  anthropic: {
    baseURL: "https://api.anthropic.com/v1",
    defaultModel: "claude-sonnet-4-5",
  },
  gemini: {
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
    defaultModel: "gemini-flash-latest",
  },
  deepseek: {
    baseURL: "https://api.deepseek.com",
    defaultModel: "deepseek-chat",
  },
  groq: {
    baseURL: "https://api.groq.com/openai/v1",
    defaultModel: "llama-3.3-70b-versatile",
  },
  mistral: {
    baseURL: "https://api.mistral.ai/v1",
    defaultModel: "mistral-large-latest",
  },
  together: {
    baseURL: "https://api.together.xyz/v1",
    defaultModel: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
  },
  fireworks: {
    baseURL: "https://api.fireworks.ai/inference/v1",
    defaultModel: "accounts/fireworks/models/llama-v3p3-70b-instruct",
  },
  openrouter: {
    baseURL: "https://openrouter.ai/api/v1",
    defaultModel: "anthropic/claude-3.5-sonnet",
  },
  cerebras: {
    baseURL: "https://api.cerebras.ai/v1",
    defaultModel: "llama-3.3-70b",
  },
  glm: {
    baseURL: "https://api.z.ai/api/coding/paas/v4",
    defaultModel: "glm-4.7",
  },
  ollama: { baseURL: "http://localhost:11434/v1", defaultModel: "llama3.1" },
  /** OpenAI-compatible: https://agentrouter.org/v1 */
  agentrouter: {
    baseURL: "https://agentrouter.org/v1",
    defaultModel: "gpt-4o",
  },
};

/** Default bila env/config tidak menyebut provider (AgentRouter). */
const DEFAULT_PROVIDER = "agentrouter";

export function listProviderIds(): string[] {
  return Object.keys(PROVIDER_TEMPLATES).sort();
}

export interface ProviderTemplateItem {
  name: string;
  url: string;
  defaultModel: string;
  requiresApiKey: boolean;
}

export function getProviderTemplates(): ProviderTemplateItem[] {
  const entries = Object.entries(PROVIDER_TEMPLATES).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  const list = entries.map(([name, t]) => ({
    name,
    url: t.baseURL,
    defaultModel: t.defaultModel,
    requiresApiKey: name !== "ollama",
  }));
  list.push({
    name: "Custom",
    url: "",
    defaultModel: "",
    requiresApiKey: true,
  });
  return list;
}

export function resolveProviderDefaults(
  providerName?: string,
): ProviderTemplate {
  if (!providerName) {
    return PROVIDER_TEMPLATES[DEFAULT_PROVIDER];
  }

  return (
    PROVIDER_TEMPLATES[providerName.toLowerCase()] ??
    PROVIDER_TEMPLATES[DEFAULT_PROVIDER]
  );
}

export class OpenAIProvider implements Provider {
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(options: OpenAIProviderOptions) {
    const timeoutMs = getRequestTimeoutMs();
    this.client = new OpenAI({
      apiKey: options.apiKey,
      baseURL: options.baseURL,
      timeout: timeoutMs,
    });
    this.model = options.model;
  }

  async review(request: ReviewRequest): Promise<ReviewResponse> {
    const prompt = buildReviewPrompt(request);

    try {
      const maxTokens = getMaxOutputTokens();
      const response = await this.client.chat.completions.create({
        model: this.model,
        temperature: 0.2,
        ...(maxTokens != null && { max_tokens: maxTokens }),
        messages: [
          {
            role: "system",
            content: REVIEW_SYSTEM_PROMPT,
          },
          {
            role: "user",
            content: prompt,
          },
        ],
      });

      const markdown = response.choices?.[0]?.message?.content?.trim() ?? "";
      const risk = extractRiskLevel(markdown);

      return { markdown, risk };
    } catch (err: unknown) {
      if (isRateLimitError(err)) {
        throw new Error(messageForRateLimit(err));
      }
      const status = (err as { status?: number })?.status;
      if (typeof status === "number") {
        throw new Error(messageForStatus(status));
      }
      if (err instanceof Error) {
        if (err.name === "AbortError" || err.message?.includes("timeout")) {
          const timeoutMs = getRequestTimeoutMs();
          throw new Error(
            `Request timeout after ${timeoutMs / 1000}s. Set REVIUAH_REQUEST_TIMEOUT_MS to change.`,
          );
        }
        throw err;
      }
      throw err;
    }
  }

  async reviewPerFile(request: ReviewRequest): Promise<PerFileReviewResponse> {
    const { system, user } = buildPerFilePrompt(request);
    return parsePerFileResponse((await this.completeJson(system, user)).text);
  }

  async fix(request: FixRequest): Promise<FixResult> {
    const { system, user } = buildFixPrompt(request);
    const { text, usage } = await this.completeJson(system, user);
    return { patches: parseFixResponse(text, request), usage };
  }

  /** Chat completion for JSON-returning prompts, with friendly API error messages. */
  private async completeJson(system: string, user: string): Promise<JsonCompletion> {
    try {
      const maxTokens = getMaxOutputTokens();
      const response = await this.client.chat.completions.create({
        model: this.model,
        temperature: 0.2,
        ...(maxTokens != null && { max_tokens: maxTokens }),
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      });

      return {
        text: response.choices?.[0]?.message?.content?.trim() ?? "{}",
        usage: response.usage && {
          inputTokens: response.usage.prompt_tokens,
          outputTokens: response.usage.completion_tokens,
        },
      };
    } catch (err: unknown) {
      if (isRateLimitError(err)) {
        throw new Error(messageForRateLimit(err));
      }
      const status = (err as { status?: number })?.status;
      if (typeof status === "number") {
        throw new Error(messageForStatus(status));
      }
      throw err;
    }
  }
}
