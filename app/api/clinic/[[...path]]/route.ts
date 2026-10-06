/**
 * Same-origin proxy for the FastAPI `clinic-agent-backend`.
 *
 * The browser only ever calls `/api/clinic/*`; this handler forwards the
 * request verbatim — path (trailing slashes included), query string, method
 * and JSON body — so the API needs no CORS configuration.
 *
 * Next.js rewrites drop trailing slashes from `:path*` destinations, which
 * made FastAPI answer `/doctor-schedule/` with a 307 whose `Location` pointed
 * straight at the backend host. A route handler preserves the exact path, and
 * any backend `Location` on the backend origin is translated back into the
 * `/api/clinic` namespace so the browser re-enters this proxy.
 *
 * Authentication: tokens live in httpOnly cookies (see `lib/auth-server.ts`).
 * The access token is attached as `Authorization: Bearer …`; when it has expired
 * the session is rotated transparently with the refresh cookie and the request is
 * retried once, so short-lived access tokens never surface as sign-outs.
 * State-changing requests must be same-origin (CSRF defence in depth).
 */

import {
  clearSessionCookies,
  getRefreshToken,
  getSessionToken,
  persistTokens,
  rotateSession,
} from "@/lib/auth-server";
import { BACKEND_URL, backendUrl } from "@/lib/backend";
import { csrfRejection, isSameOrigin, isStateChanging } from "@/lib/csrf";

/** Hop-by-hop / recomputed headers that must not be copied between requests. */
const STRIPPED_HEADERS = new Set([
  "connection",
  "content-length",
  "content-encoding",
  "cookie",
  "host",
  "keep-alive",
  "transfer-encoding",
  "upgrade",
  "te",
  "trailer",
]);

/** Path + query of the request relative to the `/api/clinic` mount point. */
function backendPath(request: Request): string {
  const { pathname, search } = new URL(request.url);
  return `${pathname.replace(/^\/api\/clinic/, "")}${search}`;
}

/**
 * Rewrite a backend `Location` header that targets the backend host back into
 * the same-origin proxy namespace; leave foreign URLs untouched.
 */
function translateLocation(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const location = new URL(raw, BACKEND_URL);
    if (location.origin !== new URL(BACKEND_URL).origin) return raw;
    return `/api/clinic${location.pathname}${location.search}`;
  } catch {
    return raw;
  }
}

/**
 * Access token for this request, rotating the session first when the access
 * cookie is missing or already expired.
 */
async function resolveAccessToken(): Promise<string | null> {
  const token = await getSessionToken();
  if (token) return token;

  const refreshToken = await getRefreshToken();
  if (!refreshToken) return null;

  const rotated = await rotateSession(refreshToken);
  if (!rotated) {
    await clearSessionCookies();
    return null;
  }

  await persistTokens(rotated);
  return rotated.access_token;
}

/** Performs one forward attempt with an explicit bearer token. */
function forward(
  target: URL,
  method: string,
  headers: Headers,
  body: ArrayBuffer | undefined,
  token: string | null,
  signal?: AbortSignal,
): Promise<Response> {
  const attemptHeaders = new Headers(headers);
  if (token) {
    attemptHeaders.set("authorization", `Bearer ${token}`);
  } else {
    attemptHeaders.delete("authorization");
  }

  const init: RequestInit = {
    method,
    headers: attemptHeaders,
    redirect: "manual",
    cache: "no-store",
  };
  if (body) init.body = body;
  // Link the browser's abort (the chat Stop button) to the upstream call so a
  // stopped reply does not keep the backend working for a client that left.
  if (signal) init.signal = signal;

  return fetch(target, init);
}

async function proxy(request: Request): Promise<Response> {
  // Cross-site writes are rejected outright: the session cookie is the only
  // credential the browser attaches, so it must never be usable cross-origin.
  if (isStateChanging(request.method) && !isSameOrigin(request)) {
    return csrfRejection();
  }

  const target = backendUrl(backendPath(request));
  const method = request.method;
  const body = method === "GET" || method === "HEAD" ? undefined : await request.arrayBuffer();

  const headers = new Headers(request.headers);
  for (const name of STRIPPED_HEADERS) headers.delete(name);
  if (!headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  // An explicit client-supplied bearer (curl, tests) wins over the cookie.
  const clientSuppliedAuth = headers.has("authorization");
  const token = clientSuppliedAuth ? null : await resolveAccessToken();

  let upstream: Response;
  try {
    upstream = await forward(target, method, headers, body, token, request.signal);
  } catch {
    return backendUnreachable();
  }

  // The access token may be refused even when the cookie still looks valid
  // (revoked account, rotated signing key, clock skew): rotate once and retry.
  if (upstream.status === 401 && !clientSuppliedAuth) {
    const refreshToken = await getRefreshToken();

    if (refreshToken) {
      const rotated = await rotateSession(refreshToken);
      if (rotated) {
        // Only now discard the rejected response — reading it later would hang.
        await upstream.body?.cancel().catch(() => undefined);
        await persistTokens(rotated);
        try {
          upstream = await forward(target, method, headers, body, rotated.access_token, request.signal);
        } catch {
          return backendUnreachable();
        }
      } else {
        await clearSessionCookies();
      }
    }
  }

  return toClientResponse(upstream);
}

function backendUnreachable(): Response {
  return Response.json(
    {
      detail:
        "Cannot reach the clinic backend. Start it with `uv run uvicorn app.main:app --reload`.",
    },
    { status: 502 },
  );
}

/** Copies a backend response to the browser, translating redirect targets. */
async function toClientResponse(upstream: Response): Promise<Response> {
  const responseHeaders = new Headers(upstream.headers);
  for (const name of STRIPPED_HEADERS) responseHeaders.delete(name);

  const location = translateLocation(upstream.headers.get("location"));
  if (location) responseHeaders.set("location", location);

  return new Response(await upstream.arrayBuffer(), {
    status: upstream.status,
    headers: responseHeaders,
  });
}

export const dynamic = "force-dynamic";

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;