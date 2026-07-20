const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002";

// Server components await these calls during render. Without a ceiling, an API
// that accepts connections but never answers hangs the render until the
// serverless function is killed, which surfaces to users as a hard "server-side
// exception" on every page. Timing out turns that into a normal rejection, so
// the existing .catch() handlers can render an offline/empty state instead.
const REQUEST_TIMEOUT_MS = 8000;

type RequestOptions = {
  token?: string;
  body?: unknown;
};

async function request<T>(
  method: string,
  path: string,
  { token, body }: RequestOptions = {}
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      // Prevent Next.js data cache from serving stale session/channel state
      cache: "no-store",
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    // Timeout and connection failures share a shape callers can handle: an
    // ApiError with a 503, rather than a raw TimeoutError/TypeError.
    const timedOut = err instanceof DOMException && err.name === "TimeoutError";
    throw new ApiError(
      503,
      timedOut ? `Request timed out after ${REQUEST_TIMEOUT_MS}ms` : "API unreachable",
    );
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(res.status, err.error ?? res.statusText);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const api = {
  get:    <T>(path: string, opts?: RequestOptions) => request<T>("GET",    path, opts),
  post:   <T>(path: string, opts?: RequestOptions) => request<T>("POST",   path, opts),
  patch:  <T>(path: string, opts?: RequestOptions) => request<T>("PATCH",  path, opts),
  delete: <T>(path: string, opts?: RequestOptions) => request<T>("DELETE", path, opts),
};
