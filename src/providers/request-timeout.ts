const DEFAULT_REQUEST_TIMEOUT_MS = 60_000;

/** Request timeout in ms (env REVIUAH_REQUEST_TIMEOUT_MS), shared by every provider. */
export function getRequestTimeoutMs(): number {
  const env = process.env.REVIUAH_REQUEST_TIMEOUT_MS;
  if (env != null) {
    const n = parseInt(env, 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return DEFAULT_REQUEST_TIMEOUT_MS;
}
