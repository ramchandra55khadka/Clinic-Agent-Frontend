/**
 * CSRF defence-in-depth for cookie-authenticated routes.
 *
 * Session cookies are `SameSite=Lax`, so a cross-site POST never carries them.
 * This check additionally rejects any state-changing request whose `Origin` does
 * not match the `Host` it was sent to. Non-browser clients (curl,
 * service-to-service calls) send no `Origin` header and are unaffected — they
 * still need a valid token.
 */

export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  const host = request.headers.get("host");
  if (!host) return false;

  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/** The 403 returned when :func:`isSameOrigin` fails. */
export function csrfRejection(): Response {
  return Response.json({ detail: "Cross-site request rejected" }, { status: 403 });
}

/** Methods that must be origin-checked (safe methods are exempt). */
export function isStateChanging(method: string): boolean {
  return !["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase());
}