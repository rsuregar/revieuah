import type {
  FileComment,
  PerFileReviewResponse,
  ReviewRequest,
  RiskLevel,
} from "./index.js";

const PER_FILE_SYSTEM = `You are ReviuAh, a code reviewer. Respond with ONLY a valid JSON object (no markdown, no fences).

Schema:
{"summary":"one paragraph","risk":"low|medium|high","comments":[{"path":"rel/path.ts","line":42,"body":"issue or suggestion","severity":"critical|warning|suggestion|praise","suggestionCode":"optional snippet when a concrete fix or optimal code helps"}]}

Severity: critical = bugs/security/breaking, fix now. warning = issues/bad practices. suggestion/praise = omit unless noteworthy.
Rules: path = from diff header (e.g. b/src/foo.ts → src/foo.ts). line = NEW file line (0 = file-level). Only comment on added/modified lines. Prefer critical/warning only; empty comments[] if low risk and no issues. Keep body 1-3 sentences.
Add "suggestionCode" only when the fix is clear, local, and short enough to paste directly. Prefer it for high-signal issues such as security bugs, unsafe API usage, incorrect framework patterns, or obvious logic fixes. Omit it for conceptual, architectural, speculative, or large refactors. Keep suggestionCode minimal and directly applicable, usually 1-6 lines. Do not include explanations, fences, placeholders, ellipses, or alternative implementations inside suggestionCode.`;

export function buildPerFilePrompt(request: ReviewRequest): {
  system: string;
  user: string;
} {
  const parts = [
    `Output language: ${request.language}.`,
    "Review the following git diff and return per-file inline comments as JSON.",
  ];
  if (request.customPrompt?.trim()) {
    parts.push(
      "",
      "Additional instructions from the user:",
      request.customPrompt.trim(),
    );
  }
  parts.push("", "Git diff:", "", request.diff);
  const user = parts.join("\n");

  return { system: PER_FILE_SYSTEM, user };
}

export function parsePerFileResponse(raw: string): PerFileReviewResponse {
  let json = raw.trim();
  if (json.startsWith("```")) {
    json = json.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
  }

  let parsed: {
    summary?: string;
    risk?: string;
    comments?: Array<{
      path?: string;
      line?: number;
      body?: string;
      severity?: string;
      suggestionCode?: string;
    }>;
  };

  try {
    parsed = JSON.parse(json);
  } catch {
    return {
      summary: "Failed to parse per-file review response from LLM.",
      risk: "unknown",
      comments: [],
    };
  }

  const validSeverities = new Set([
    "critical",
    "warning",
    "suggestion",
    "praise",
  ]);
  const validRisks = new Set(["low", "medium", "high", "unknown"]);

  const risk = validRisks.has(parsed.risk?.toLowerCase() ?? "")
    ? (parsed.risk!.toLowerCase() as RiskLevel)
    : "unknown";

  const actionableSeverities = new Set<string>(["critical", "warning"]);

  const comments: FileComment[] = (parsed.comments ?? [])
    .filter((c) => c.path && typeof c.body === "string" && c.body.trim())
    .map((c) => ({
      path: c.path!.replace(/^[ab]\//, ""),
      line: Math.max(0, Math.floor(c.line ?? 0)),
      body: c.body!.trim(),
      severity: validSeverities.has(c.severity?.toLowerCase() ?? "")
        ? (c.severity!.toLowerCase() as FileComment["severity"])
        : "warning",
      ...(typeof c.suggestionCode === "string" &&
        c.suggestionCode.trim() && {
          suggestionCode: c.suggestionCode.trim(),
        }),
    }))
    .filter((c) => actionableSeverities.has(c.severity));

  return {
    summary: parsed.summary?.trim() ?? "No summary provided.",
    risk,
    comments,
  };
}
