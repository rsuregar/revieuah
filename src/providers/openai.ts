import OpenAI from "openai";
import type { Provider, ReviewRequest, ReviewResponse, RiskLevel } from "./index.js";

const DEFAULT_MODEL = "gpt-4.1-mini";

export interface OpenAIProviderOptions {
  apiKey: string;
  baseURL?: string;
  model?: string;
}

export class OpenAIProvider implements Provider {
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(options: OpenAIProviderOptions) {
    this.client = new OpenAI({
      apiKey: options.apiKey,
      baseURL: options.baseURL
    });
    this.model = options.model ?? DEFAULT_MODEL;
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
            "You are ReviuAh, a senior software reviewer. You MUST output valid Markdown and strictly follow the required headings and order."
        },
        {
          role: "user",
          content: prompt
        }
      ]
    });

      const markdown = response.choices?.[0]?.message?.content?.trim() ?? "";
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
      request.diff
    ].join("\n");
  }
}

function extractRiskLevel(markdown: string): RiskLevel {
  const match = markdown.match(/##\s*Risk Level[\s\S]*?\b(low|medium|high|unknown)\b/i);
  const risk = match?.[1]?.toLowerCase();

  if (risk === "low" || risk === "medium" || risk === "high" || risk === "unknown") {
    return risk;
  }

  return "unknown";
}
