/**
 * Server-side access to the FastAPI `clinic-agent-backend`.
 *
 * Only import this from route handlers or server components — it reads the
 * server-only `BACKEND_URL` environment variable.
 */

export const BACKEND_URL = process.env.BACKEND_URL ?? "http://127.0.0.1:8000";

/** Absolute backend URL for a path that starts with `/`. */
export function backendUrl(path: string): URL {
  return new URL(path, BACKEND_URL);
}

/** `fetch` against the backend that never participates in Next.js caching. */
export function backendFetch(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(backendUrl(path), { cache: "no-store", ...init });
}