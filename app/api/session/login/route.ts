/**
 * Exchanges credentials for a session cookie.
 *
 * The backend's access and refresh tokens are stored in httpOnly cookies by
 * `persistTokens`, so they are never exposed to client JavaScript. Only the user
 * profile is returned to the browser.
 */

import { isSameOrigin, csrfRejection } from "@/lib/csrf";
import { persistTokens } from "@/lib/auth-server";
import { backendFetch } from "@/lib/backend";
import type { AuthUser } from "@/lib/types";

interface TokenPayload {
  access_token?: string;
  refresh_token?: string;
  user?: AuthUser;
  detail?: unknown;
}

export async function POST(request: Request): Promise<Response> {
  if (!isSameOrigin(request)) return csrfRejection();

  let credentials: unknown;
  try {
    credentials = await request.json();
  } catch {
    return Response.json({ detail: "Invalid JSON body" }, { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await backendFetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(credentials),
    });
  } catch {
    return Response.json({ detail: "Cannot reach the clinic backend." }, { status: 502 });
  }

  const payload = (await upstream.json().catch(() => null)) as TokenPayload | null;

  if (!upstream.ok) {
    return Response.json(payload ?? { detail: "Sign in failed" }, { status: upstream.status });
  }

  const accessToken = payload?.access_token;
  if (!accessToken) {
    return Response.json({ detail: "The clinic backend returned no access token." }, { status: 502 });
  }

  await persistTokens({
    access_token: accessToken,
    refresh_token: payload?.refresh_token,
    user: payload?.user,
  });
  return Response.json({ user: payload?.user });
}