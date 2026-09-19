/**
 * Browser-side session calls.
 *
 * Credentials are exchanged with the backend by the Next.js route handlers
 * under `/api/session`, which keep the access token inside an httpOnly cookie.
 * The token itself therefore never reaches this code.
 */

import type { AuthUser, LoginInput, RegisterInput } from "./types";

/** Fired when an API call is rejected with 401 so the UI can return to `/login`. */
export const SESSION_EXPIRED_EVENT = "clinic-agent:session-expired";

export function notifySessionExpired(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
  }
}

interface SessionResponse {
  user?: AuthUser;
  detail?: string;
}

async function postSession(path: string, payload?: unknown): Promise<AuthUser> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload ?? {}),
      cache: "no-store",
    });
  } catch {
    throw new Error("Cannot reach the clinic backend. Is it running?");
  }

  const raw = await response.text();
  let body: SessionResponse | null = null;
  if (raw) {
    try {
      body = JSON.parse(raw) as SessionResponse;
    } catch {
      body = null;
    }
  }

  if (!response.ok) {
    throw new Error(body?.detail ?? `Request failed with status ${response.status}`);
  }
  if (!body?.user) {
    throw new Error("The clinic backend did not return a user profile.");
  }
  return body.user;
}

/** Signs in and returns the profile stored in the resulting session. */
export function signIn(input: LoginInput): Promise<AuthUser> {
  return postSession("/api/session/login", input);
}

/** Registers an account (the backend logs it in immediately). */
export function signUp(input: RegisterInput): Promise<AuthUser> {
  return postSession("/api/session/register", input);
}

/** Clears the session cookie; safe to call when no session exists. */
export async function signOut(): Promise<void> {
  try {
    await fetch("/api/session/logout", { method: "POST", cache: "no-store" });
  } catch {
    // A failed sign-out must never block the UI from dropping local state.
  }
}

/**
 * Attempts a silent token rotation.
 *
 * The API proxy already refreshes expired access tokens transparently, so this
 * is a safety net for the case where a request was rejected anyway. Resolves to
 * `null` when the session cannot be recovered (the caller then signs out).
 */
export async function refreshSession(): Promise<AuthUser | null> {
  try {
    const response = await fetch("/api/session/refresh", {
      method: "POST",
      cache: "no-store",
    });
    if (!response.ok) return null;

    const body = (await response.json()) as { user?: AuthUser | null };
    return body.user ?? null;
  } catch {
    return null;
  }
}