export type RiskLevel = "low" | "medium" | "high" | "unknown";

export interface ReviewRequest {
  diff: string;
  language: string;
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
}

export interface PerFileReviewResponse {
  /** Overall summary markdown (short). */
  summary: string;
  risk: RiskLevel;
  /** Per-file inline comments. */
  comments: FileComment[];
}

export interface Provider {
  review(request: ReviewRequest): Promise<ReviewResponse>;
  reviewPerFile?(request: ReviewRequest): Promise<PerFileReviewResponse>;
}

/** Credentials used to create a provider (e.g. from config + env). */
export interface ProviderCredentials {
  apiKey: string;
  baseURL: string;
  model: string;
}
