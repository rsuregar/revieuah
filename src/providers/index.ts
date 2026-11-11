export type RiskLevel = "low" | "medium" | "high" | "unknown";

export interface ReviewRequest {
  diff: string;
  language: string;
  /** Optional custom instructions (e.g. focus areas, style) for the reviewer. */
  customPrompt?: string;
  /** If true, request minimal output (fewer sections, fewer tokens). */
  compact?: boolean;
}

export interface ReviewResponse {
  markdown: string;
  risk: RiskLevel;
}

/** Per-file inline comment returned by reviewPerFile. */
export interface FileComment {
  /** Relative file path from the diff (e.g. "src/utils.ts"). */
  path: string;
  /** Line number in the NEW file (right side of diff). 0 = file-level comment. */
  line: number;
  /** Review body for this location. */
  body: string;
  /** Severity hint. */
  severity: "critical" | "warning" | "suggestion" | "praise";
  /** Optional suggested code (optimal fix or improvement). When present, can be shown as a code block. */
  suggestionCode?: string;
}

export interface PerFileReviewResponse {
  /** Overall summary markdown (short). */
  summary: string;
  risk: RiskLevel;
  /** Per-file inline comments. */
  comments: FileComment[];
}

export interface FixFile {
  /** Path relative to the repo root. */
  path: string;
  /** Current working-tree content (not the diff). */
  content: string;
}

export interface FixRequest {
  comments: FileComment[];
  files: FixFile[];
  language: string;
  /** Project rules and/or user instructions. */
  customPrompt?: string;
  /** Output of a failed verification run; set only on a retry. */
  verifyFailure?: string;
}

/** One search/replace edit. `search` must match exactly once in the file. */
export interface FixPatch {
  path: string;
  search: string;
  replace: string;
  /** Index into FixRequest.comments handled by this patch. */
  commentIndex: number;
  explanation: string;
}

/** Token counts reported by the API for one completion. */
export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface FixResult {
  patches: FixPatch[];
  /** Absent when the API does not report usage. */
  usage?: TokenUsage;
}

export interface Provider {
  review(request: ReviewRequest): Promise<ReviewResponse>;
  reviewPerFile?(request: ReviewRequest): Promise<PerFileReviewResponse>;
  fix?(request: FixRequest): Promise<FixResult>;
}

/** Credentials used to create a provider (e.g. from config + env). */
export interface ProviderCredentials {
  apiKey: string;
  baseURL: string;
  model: string;
}

/** A local CLI (stdin prompt, stdout answer) that handles its own login; see CommandProvider. */
export interface CommandCredentials {
  command: string;
}
