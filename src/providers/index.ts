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

/** Credentials used to create a provider (e.g. from config + env). */
export interface ProviderCredentials {
  apiKey: string;
  baseURL: string;
  model: string;
}
