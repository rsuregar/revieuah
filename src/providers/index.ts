export type RiskLevel = "low" | "medium" | "high" | "unknown";

export interface ReviewRequest {
  diff: string;
  language: string;
}

export interface ReviewResponse {
  markdown: string;
  risk: RiskLevel;
}

export interface Provider {
  review(request: ReviewRequest): Promise<ReviewResponse>;
}
