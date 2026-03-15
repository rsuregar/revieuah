import OpenAI from "openai";
import type {
  Provider,
  ReviewRequest,
  ReviewResponse,
  RiskLevel,
} from "./index.js";

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
  /** OpenAI-compatible; native API is .../v1beta/models/gemini-flash-latest:generateContent */
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
    this.client = new OpenAI({
      apiKey: options.apiKey,
      baseURL: options.baseURL,
    });
    this.model = options.model;
  }

  async review(request: ReviewRequest): Promise<ReviewResponse> {
    const prompt = this.buildPrompt(request);

    const response = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "You are ReviuAh, a senior software reviewer. You MUST output valid Markdown and strictly follow the required headings and order.",
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
  }

  private buildPrompt(request: ReviewRequest): string {
    return [
      "Review the following git diff.",
      `Output language: ${request.language}.`,
      "Return Markdown with EXACTLY these sections and order:",
      "## Summary",
      "## Risk Level",
      "Low | Medium | High | Unknown",
      "Reason:",
      "## Security Review",
      "## Performance Review",
      "## Testing Suggestions",
      "## Code Quality & Maintainability",
      "## Actionable Suggestions",
      "Keep the review concise and practical.",
      "\nGit diff:\n",
      request.diff,
    ].join("\n");
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
