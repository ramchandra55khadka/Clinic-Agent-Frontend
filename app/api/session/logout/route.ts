/**
 * Ends the session.
 *
 * The refresh token is revoked on the backend first (so it can never be
 * replayed), then both httpOnly cookies are deleted. Access tokens are
 * short-lived JWTs and are simply discarded by the browser.
 */

import { clearSessionCookies, getRefreshToken } from "@/lib/auth-server";
import { backendFetch } from "@/lib/backend";
import { csrfRejection, isSameOrigin } from "@/lib/csrf";

export async function POST(request: Request): Promise<Response> {
  if (!isSameOrigin(request)) return csrfRejection();

  const refreshToken = await getRefreshToken();

  if (refreshToken) {
    try {
      await backendFetch("/api/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
    } catch {
      // Best effort: the user must be able to sign out even if the API is down.
    }
  }

  await clearSessionCookies();
  return Response.json({ ok: true });
}