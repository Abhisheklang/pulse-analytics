export type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

export interface PulseClientOptions {
  /**
   * API base URL. Defaults to a local Pulse Analytics instance (`http://localhost:3000`).
   * For a remote self-hosted instance use its URL plus `/api`, e.g. `https://analytics.example.com/api`.
   */
  baseUrl?: string;
  /**
   * Bearer token: a login token from `POST /api/auth/login`, or a
   * self-hosted API key.
   */
  token?: string;
  /**
   * API key. Sent as `x-pulse-api-key`. When no `token` is provided the key is also
   * sent as a bearer token so that self-hosted API keys work with either option.
   */
  apiKey?: string;
  /** Extra headers sent with every request. */
  headers?: Record<string, string>;
  /** Custom fetch implementation (testing, alternative runtimes, in-process dispatch). */
  fetch?: FetchLike;
  /** Per-request timeout in milliseconds. Disabled by default. */
  timeout?: number;
}

export interface RequestOptions {
  /** Extra headers for this request only. */
  headers?: Record<string, string>;
  /** Abort signal for this request. */
  signal?: AbortSignal;
}
