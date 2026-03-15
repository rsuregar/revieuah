import type {
  Provider,
  ReviewRequest,
  ReviewResponse,
  RiskLevel,
} from "./index.js";

const SYSTEM_PROMPT =
  "You are ReviuAh, a senior software reviewer. You MUST output valid Markdown and strictly follow the required headings and order.";

function buildPrompt(request: ReviewRequest): string {
  return [
    SYSTEM_PROMPT,
    "",
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

export interface GeminiNativeProviderOptions {
  /** Full URL, e.g. https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent */
  generateContentUrl: string;
  apiKey: string;
}

/**
 * Provider that calls Gemini native generateContent API (X-goog-api-key).
 * Use when REVIUAH_PROVIDER_URL is a full generateContent URL.
 */
export class GeminiNativeProvider implements Provider {
  private readonly url: string;
  private readonly apiKey: string;

  constructor(options: GeminiNativeProviderOptions) {
    this.url = options.generateContentUrl.replace(/"+$/, "").trim();
    this.apiKey = options.apiKey;
  }

  async review(request: ReviewRequest): Promise<ReviewResponse> {
    const text = buildPrompt(request);

    const res = await fetch(this.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-goog-api-key": this.apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text }] }],
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`${res.status} ${res.statusText}: ${body}`);
    }

    const data = (await res.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
    };

    const markdown =
      data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
    const risk = extractRiskLevel(markdown);

    return { markdown, risk };
  }
}
