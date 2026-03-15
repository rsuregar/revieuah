import OpenAI from "openai";
import type {
  PerFileReviewResponse,
  Provider,
  ReviewRequest,
  ReviewResponse,
  RiskLevel,
} from "./index.js";
import { buildPerFilePrompt, parsePerFileResponse } from "./per-file-prompt.js";

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

const DEFAULT_REQUEST_TIMEOUT_MS = 60_000;

function getRequestTimeoutMs(): number {
  const env = process.env.REVIUAH_REQUEST_TIMEOUT_MS;
  if (env != null) {
    const n = parseInt(env, 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return DEFAULT_REQUEST_TIMEOUT_MS;
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
    const prompt = this.buildPrompt(request);

    try {
      const maxTokens = getMaxOutputTokens();
      const response = await this.client.chat.completions.create({
        model: this.model,
        temperature: 0.2,
        ...(maxTokens != null && { max_tokens: maxTokens }),
        messages: [
          {
            role: "system",
            content:
              "You are ReviuAh, a concise code reviewer. Output only valid Markdown. Use the exact section headings given. Prefer bullets; max 2-3 sentences per section.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
      });

      const markdown = response.choices[0]?.message?.content?.trim() ?? "";
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

      const raw = response.choices[0]?.message?.content?.trim() ?? "{}";
      return parsePerFileResponse(raw);
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

  private buildPrompt(request: ReviewRequest): string {
    const lang = `Output language: ${request.language}.`;
    const compact = request.compact === true;

    const parts: string[] = ["Review this git diff. " + lang];

    if (compact) {
      parts.push(
        "",
        "Use ONLY these sections (keep each very short):",
        "## Summary",
        "One short paragraph.",
        "## Risk Level",
        "Low | Medium | High | Unknown",
        "Reason: (one line)",
        "## Suggestions",
        "3–5 bullet points (most important only).",
        "",
        "Be brief.",
      );
    } else {
      parts.push(
        "",
        "Use ONLY these sections. Max 2–3 sentences or a few bullets per section:",
        "## Summary",
        "## Risk Level",
        "Low | Medium | High | Unknown",
        "Reason:",
        "## Security & Performance",
        "## Testing & Quality",
        "## Actionable Suggestions",
        "",
        "Keep concise; bullets preferred.",
      );
    }

    if (request.customPrompt?.trim()) {
      parts.push("", "User instructions:", request.customPrompt.trim());
    }
    parts.push("", "Git diff:", "", request.diff);
    return parts.join("\n");
  }
}

function extractRiskLevel(markdown: string): RiskLevel {
  const match = markdown.match(
    /##\s*Risk Level[\s\S]*?\b(low|medium|high|unknown)\b/i,
  );
  const risk = match?.[1]?.toLowerCase();

  if (
    risk === "low" ||
    risk === "medium" ||
    risk === "high" ||
    risk === "unknown"
  ) {
    return risk;
  }

  return "unknown";
}
