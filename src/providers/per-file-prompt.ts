import type { FileComment, PerFileReviewResponse, ReviewRequest, RiskLevel } from "./index.js";

const PER_FILE_SYSTEM = `You are ReviuAh, a senior software reviewer.
You review git diffs and produce per-file inline comments in JSON format.

You MUST respond with ONLY a valid JSON object, no markdown fences, no extra text.

JSON schema:
{
  "summary": "One-paragraph overall summary of the changes.",
  "risk": "low | medium | high",
  "comments": [
    {
      "path": "relative/file/path.ts",
      "line": 42,
      "body": "Explanation of the issue or suggestion.",
      "severity": "critical | warning | suggestion | praise"
    }
  ]
}

Severity definitions:
- "critical": Bugs, security vulnerabilities, data loss, breaking changes. MUST be fixed.
- "warning": Potential issues, performance concerns, bad practices. Should be fixed.
- "suggestion": Minor improvements, readability, style. Nice to have.
- "praise": Well-written code. Only include if truly outstanding.

Rules:
- "path" must match the file path from the diff header (e.g. b/src/foo.ts → src/foo.ts).
- "line" is the line number in the NEW version of the file (right side of diff). Use 0 for file-level comments.
- Only comment on lines that actually appear in the diff (added or modified).
- Focus on real issues: bugs, security, performance, logic errors. Skip trivial formatting.
- Only include comments with severity "critical" or "warning". Skip "suggestion" and "praise" unless the change is truly noteworthy.
- If risk is "low" and there are no critical/warning issues, return an empty comments array.
- Keep each "body" concise (1-3 sentences).
- Do NOT wrap response in markdown code fences.`;

export function buildPerFilePrompt(request: ReviewRequest): { system: string; user: string } {
  const parts = [
    `Output language: ${request.language}.`,
    "Review the following git diff and return per-file inline comments as JSON.",
  ];
  if (request.customPrompt?.trim()) {
    parts.push("", "Additional instructions from the user:", request.customPrompt.trim());
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

  const validSeverities = new Set(["critical", "warning", "suggestion", "praise"]);
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
    }))
    .filter((c) => actionableSeverities.has(c.severity));

  return {
    summary: parsed.summary?.trim() ?? "No summary provided.",
    risk,
    comments,
  };
}
