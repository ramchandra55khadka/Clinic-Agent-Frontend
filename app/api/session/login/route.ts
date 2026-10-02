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
  try {
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
    } catch (error) {
      console.error("Login backend request failed", error);
      return Response.json({ detail: "Cannot reach the clinic backend. Start the backend on port 8000 and try again." }, { status: 502 });
    }

    const payload = (await upstream.json().catch(() => null)) as TokenPayload | null;

    if (!upstream.ok) {
      return Response.json(payload ?? { detail: "Sign in failed" }, { status: upstream.status });
    }

    const accessToken = payload?.access_token;
    if (!accessToken) {
      return Response.json({ detail: "The clinic backend returned no access token." }, { status: 502 });
    }

    let user = payload?.user;
    if (!user) {
      try {
        const meResponse = await backendFetch("/api/auth/me", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (meResponse.ok) user = (await meResponse.json()) as AuthUser;
      } catch {
        // Keep the clearer response below.
      }
    }
    if (!user) {
      return Response.json({ detail: "The clinic backend returned no user profile." }, { status: 502 });
    }

    try {
      await persistTokens({
        access_token: accessToken,
        refresh_token: payload?.refresh_token,
        user,
      });
    } catch {
      return Response.json({ detail: "Could not create a browser session. Please try again." }, { status: 500 });
    }

    return Response.json({ user });
  } catch {
    return Response.json({ detail: "Sign in failed because the session service crashed." }, { status: 500 });
  }
}
