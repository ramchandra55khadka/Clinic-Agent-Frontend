/**
 * Server-side session helpers.
 *
 * The bearer token issued by the backend lives in an httpOnly cookie, so client
 * JavaScript can never read it. Route handlers set/clear it, server components
 * read it, and the `/api/clinic` proxy converts it into the
 * `Authorization: Bearer …` header the backend expects.
 *
 * The cookie only gates rendering; every API call is authorised by the backend
 * itself, which verifies the token signature on each request.
 */

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { backendFetch } from "./backend";
import { decodeTokenClaims, isTokenExpired } from "./token";
import type { AuthUser, TokenClaims, UserRole } from "./types";

export const SESSION_COOKIE = "clinic_session";

/**
 * Refresh token, scoped to `/api` so it is only ever sent to our own route
 * handlers — never to page navigations or to the backend directly.
 */
export const REFRESH_COOKIE = "clinic_refresh";
const REFRESH_COOKIE_PATH = "/api";

/** Cookie lifetime used when the token carries no usable `exp` claim. */
const FALLBACK_MAX_AGE_SECONDS = 60 * 60;

/** Backend refresh-token lifetime, mirrored for the cookie's Max-Age. */
const REFRESH_MAX_AGE_SECONDS = 60 * 60 * 24 * 14;

/** Session token from the cookie, or `null` when missing/already expired. */
export async function getSessionToken(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token || isTokenExpired(token)) return null;
  return token;
}

/** Full profile of the signed-in user, fetched from the backend, or `null`. */
export async function getSessionUser(): Promise<AuthUser | null> {
  const token = await getSessionToken();
  if (!token) return null;

  try {
    const response = await backendFetch("/api/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return null;
    return (await response.json()) as AuthUser;
  } catch {
    // Backend unreachable: render as signed-out rather than crashing the page.
    return null;
  }
}

/**
 * Sends visitors without any usable session to `/login`, remembering where they were.
 *
 * A still-valid refresh cookie counts as a session: the access token expires
 * after 15 minutes and the API proxy rotates it transparently on the next call,
 * so an expired access token must not bounce the user to the sign-in page.
 *
 * This runs inside the page component, so it must stay cheap (cookie reads only).
 */
export async function requireSession(nextPath: string): Promise<void> {
  if ((await getRefreshToken()) !== null) return;

  const token = await getSessionToken();
  if (!token) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
}

/** Claims from the session cookie, readable even when the access token has expired. */
async function getSessionClaims(): Promise<TokenClaims | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  return token ? decodeTokenClaims(token) : null;
}

/**
 * Server-side role guard for a page.
 *
 * - no session at all → `/login?next=…`
 * - a *known* role that is not allowed → `/forbidden?from=…`
 *
 * The role is taken from the backend (`/auth/me`) when the access token is still
 * valid, and otherwise from the token's own claims. When neither is readable but
 * a refresh cookie is present, the page is allowed to render: the backend
 * authorises every API call, so at worst the page's data requests come back 403.
 * This keeps a merely-expired access token from bouncing a legitimate staff
 * member to the sign-in page.
 */
export async function requireRole(nextPath: string, allowed: readonly UserRole[]): Promise<void> {
  const user = await getSessionUser();
  if (user) {
    if (!allowed.includes(user.role as UserRole)) {
      redirect(`/forbidden?from=${encodeURIComponent(nextPath)}`);
    }
    return;
  }

  const claims = await getSessionClaims();
  if (claims?.role) {
    if (!allowed.includes(claims.role as UserRole)) {
      redirect(`/forbidden?from=${encodeURIComponent(nextPath)}`);
    }
    return;
  }

  if ((await getRefreshToken()) !== null) return;
  redirect(`/login?next=${encodeURIComponent(nextPath)}`);
}

/** Stores the backend access token in the httpOnly session cookie. */
export async function setSessionCookie(token: string): Promise<void> {
  const expiresAt = decodeTokenClaims(token)?.exp;
  const nowSeconds = Math.floor(Date.now() / 1000);
  const maxAge = expiresAt ? Math.max(0, expiresAt - nowSeconds) : FALLBACK_MAX_AGE_SECONDS;

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  });
}

/** Removes the session cookie (sign out). */
export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/* ------------------------------------------------------------------ */
/* Refresh tokens                                                      */
/* ------------------------------------------------------------------ */

export interface TokenBundle {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  user?: AuthUser;
}

/** Stores the refresh token in its own httpOnly cookie. */
export async function setRefreshCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(REFRESH_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: REFRESH_COOKIE_PATH,
    maxAge: REFRESH_MAX_AGE_SECONDS,
  });
}

/** Refresh token from the cookie, or `null`. */
export async function getRefreshToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(REFRESH_COOKIE)?.value ?? null;
}

/** Persists a fresh token pair returned by the backend. */
export async function persistTokens(tokens: TokenBundle): Promise<void> {
  await setSessionCookie(tokens.access_token);
  if (tokens.refresh_token) await setRefreshCookie(tokens.refresh_token);
}

/**
 * Deletes both cookies. The refresh cookie must be cleared with the same path it
 * was created with, otherwise the browser keeps it.
 */
export async function clearSessionCookies(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  store.set(REFRESH_COOKIE, "", { path: REFRESH_COOKIE_PATH, maxAge: 0 });
}

/**
 * Exchanges the refresh token for a new token pair (rotation happens backend-side).
 * Returns `null` when the token is rejected, in which case the caller signs the
 * user out.
 */
export async function rotateSession(refreshToken: string): Promise<TokenBundle | null> {
  try {
    const response = await backendFetch("/api/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!response.ok) return null;

    const payload = (await response.json()) as TokenBundle;
    if (!payload?.access_token) return null;
    return payload;
  } catch {
    // Backend unreachable: keep the session as-is and let the call fail loudly.
    return null;
  }
}