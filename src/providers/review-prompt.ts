import type { ReviewRequest, RiskLevel } from "./index.js";

export const REVIEW_SYSTEM_PROMPT =
  "You are ReviuAh, a concise code reviewer. Output only valid Markdown. Use the exact section headings given. Prefer bullets; max 2-3 sentences per section.";

export function buildReviewPrompt(request: ReviewRequest): string {
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

export function extractRiskLevel(markdown: string): RiskLevel {
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
