/**
 * Helpers for reading the backend's HS256 access token.
 *
 * The signature is never verified here — only the backend does that — so these
 * functions are used purely to read the identity/expiry claims for UI and
 * routing decisions. They run on both the server and the client, hence the
 * plain base64url decoding instead of Node's `Buffer`.
 */

import type { TokenClaims } from "./types";

function base64UrlToJson(value: string): unknown {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

/** Decoded token payload, or `null` when the token is malformed. */
export function decodeTokenClaims(token: string): TokenClaims | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const payload = base64UrlToJson(parts[1]);
    if (!payload || typeof payload !== "object") return null;
    return payload as TokenClaims;
  } catch {
    return null;
  }
}

/** Epoch milliseconds at which the token stops being valid, or `null`. */
export function tokenExpiresAt(token: string): number | null {
  const exp = decodeTokenClaims(token)?.exp;
  return typeof exp === "number" ? exp * 1000 : null;
}

/**
 * Treats a token as expired `skewMs` before its `exp` so a request is never sent
 * with credentials that expire in flight.
 */
export function isTokenExpired(token: string, skewMs = 30_000): boolean {
  const expiresAt = tokenExpiresAt(token);
  if (expiresAt === null) return true;
  return expiresAt - skewMs <= Date.now();
}