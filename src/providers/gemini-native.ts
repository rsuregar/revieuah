import type {
  Provider,
  ReviewRequest,
  ReviewResponse,
  RiskLevel,
} from "./index.js";

const DEFAULT_REQUEST_TIMEOUT_MS = 60_000;

function getRequestTimeoutMs(): number {
  const env = process.env.REVIUAH_REQUEST_TIMEOUT_MS;
  if (env != null) {
    const n = parseInt(env, 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return DEFAULT_REQUEST_TIMEOUT_MS;
}

function messageForStatus(status: number, body: string): string {
  switch (status) {
    case 400:
      return `Bad request (400). Periksa URL/model. ${body || ""}`.trim();
    case 401:
      return "Authentication failed (401). Periksa API key.";
    case 403:
      return "Forbidden (403). API key tidak punya akses.";
    case 404:
      return "Not found (404). Model atau endpoint salah.";
    case 429:
      return "Rate limit (429). Coba lagi nanti.";
    case 500:
    case 502:
    case 503:
      return `Server error (${status}). Coba lagi nanti.`;
    default:
      return `${status}: ${body || "Request failed"}`.trim();
  }
}

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
    const timeoutMs = getRequestTimeoutMs();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(this.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-goog-api-key": this.apiKey,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text }] }],
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        const body = await res.text();
        throw new Error(messageForStatus(res.status, body));
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
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof Error) {
        if (err.name === "AbortError") {
          throw new Error(
            `Request timeout setelah ${timeoutMs / 1000}s. Set REVIUAH_REQUEST_TIMEOUT_MS untuk mengubah.`,
          );
        }
        throw err;
      }
      throw err;
    }
  }
}
