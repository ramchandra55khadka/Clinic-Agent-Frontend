/**
 * Rotates the session using the refresh cookie.
 *
 * The API proxy refreshes tokens itself when the access token has expired; this
 * endpoint exists for the client to recover after a 401 without a page reload.
 * Every rotation invalidates the previous refresh token (backend-side), and a
 * replayed token revokes the whole chain.
 */

import { clearSessionCookies, getRefreshToken, persistTokens, rotateSession } from "@/lib/auth-server";
import { csrfRejection, isSameOrigin } from "@/lib/csrf";

export async function POST(request: Request): Promise<Response> {
  if (!isSameOrigin(request)) return csrfRejection();

  const refreshToken = await getRefreshToken();
  if (!refreshToken) {
    return Response.json({ detail: "No active session" }, { status: 401 });
  }

  const tokens = await rotateSession(refreshToken);
  if (!tokens) {
    await clearSessionCookies();
    return Response.json({ detail: "Session expired" }, { status: 401 });
  }

  await persistTokens(tokens);
  return Response.json({ user: tokens.user ?? null });
}