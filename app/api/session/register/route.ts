/**
 * Creates an account, writes the matching profile, and starts a session.
 *
 * The backend keeps credentials and personal profile fields decoupled:
 * `/api/auth/register` creates email/password, then `/api/profiles` creates the
 * signed-in user's name/contact profile. The browser only receives the final
 * full account profile.
 */

import { isSameOrigin, csrfRejection } from "@/lib/csrf";
import { persistTokens } from "@/lib/auth-server";
import { backendFetch } from "@/lib/backend";
import type { AuthUser, RegisterInput } from "@/lib/types";

interface TokenPayload {
  access_token?: string;
  refresh_token?: string;
  user?: AuthUser;
  detail?: unknown;
}

export async function POST(request: Request): Promise<Response> {
  try {
    if (!isSameOrigin(request)) return csrfRejection();

    let registration: RegisterInput;
    try {
      registration = (await request.json()) as RegisterInput;
    } catch {
      return Response.json({ detail: "Invalid JSON body" }, { status: 400 });
    }

    let upstream: Response;
    try {
      upstream = await backendFetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: registration.email,
          password: registration.password,
        }),
      });
    } catch {
      return Response.json({ detail: "Cannot reach the clinic backend. Start the backend on port 8000 and try again." }, { status: 502 });
    }

    const payload = (await upstream.json().catch(() => null)) as TokenPayload | null;

    if (!upstream.ok) {
      return Response.json(payload ?? { detail: "Registration failed" }, { status: upstream.status });
    }

    const accessToken = payload?.access_token;
    if (!accessToken) {
      return Response.json({ detail: "The clinic backend returned no access token." }, { status: 502 });
    }

    try {
      const profileResponse = await backendFetch("/api/profiles", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          first_name: registration.first_name,
          last_name: registration.last_name || null,
          phone: registration.phone || null,
        }),
      });

      if (!profileResponse.ok) {
        const profilePayload = await profileResponse.json().catch(() => null);
        return Response.json(profilePayload ?? { detail: "Profile creation failed" }, { status: profileResponse.status });
      }
    } catch {
      return Response.json({ detail: "Could not create your clinic profile. Please try again." }, { status: 502 });
    }

    let user = payload?.user;
    try {
      const meResponse = await backendFetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (meResponse.ok) user = (await meResponse.json()) as AuthUser;
    } catch {
      // Fall back to the account shape from registration.
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

    return Response.json({ user }, { status: upstream.status });
  } catch {
    return Response.json({ detail: "Registration failed because the session service crashed." }, { status: 500 });
  }
}
