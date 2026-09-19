"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { getMe } from "@/lib/api";
import { SESSION_EXPIRED_EVENT, refreshSession, signIn, signOut, signUp } from "@/lib/session";
import type { AuthUser, LoginInput, RegisterInput } from "@/lib/types";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

export interface AuthContextValue {
  user: AuthUser | null;
  status: AuthStatus;
  setCurrentUser: (user: AuthUser) => void;
  login: (input: LoginInput) => Promise<AuthUser>;
  register: (input: RegisterInput) => Promise<AuthUser>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Holds the signed-in user for the whole app.
 *
 * The initial value is resolved on the server (see `app/layout.tsx`), so the
 * first paint already knows whether a session exists. Credentials never pass
 * through this component: they go to `/api/session/*`, which stores the
 * backend token in an httpOnly cookie.
 */
export function AuthProvider({
  initialUser,
  children,
}: {
  initialUser: AuthUser | null;
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUser | null>(initialUser);
  const [status, setStatus] = useState<AuthStatus>(
    initialUser ? "authenticated" : "unauthenticated",
  );

  const goToLogin = useCallback(
    (reason?: "expired") => {
      if (pathname === "/login") return;
      const params = new URLSearchParams();
      if (pathname) params.set("next", pathname);
      if (reason) params.set("reason", reason);
      const query = params.toString();
      router.replace(query ? `/login?${query}` : "/login");
    },
    [pathname, router],
  );

  /* A 401 from any API call means the cookie is no longer accepted: try one
     silent rotation (the refresh cookie may still be valid) before signing out.
     The backend stays the source of truth either way. */
  useEffect(() => {
    let active = true;

    async function handleExpired() {
      const refreshed = await refreshSession();
      if (!active) return;

      if (refreshed) {
        setUser(refreshed);
        setStatus("authenticated");
        return;
      }

      setUser(null);
      setStatus("unauthenticated");
      void signOut();
      goToLogin("expired");
    }

    window.addEventListener(SESSION_EXPIRED_EVENT, handleExpired);
    return () => {
      active = false;
      window.removeEventListener(SESSION_EXPIRED_EVENT, handleExpired);
    };
  }, [goToLogin]);

  /* The layout validated the cookie, but re-fetch the profile once so a revoked
     or deactivated account is noticed while a tab stays open. */
  useEffect(() => {
    if (!initialUser) return;
    let active = true;

    getMe()
      .then((fresh) => {
        if (active) setUser(fresh);
      })
      .catch(() => {
        /* 401 is handled by the session-expired listener. */
      });

    return () => {
      active = false;
    };
  }, [initialUser]);

  const setCurrentUser = useCallback((account: AuthUser) => {
    setUser(account);
    setStatus("authenticated");
  }, []);

  const login = useCallback(async (input: LoginInput) => {
    const account = await signIn(input);
    setUser(account);
    setStatus("authenticated");
    return account;
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    const account = await signUp(input);
    setUser(account);
    setStatus("authenticated");
    return account;
  }, []);

  const logout = useCallback(async () => {
    await signOut();
    setUser(null);
    setStatus("unauthenticated");
    router.replace("/login");
  }, [router]);

  const value = useMemo<AuthContextValue>(
    () => ({ user, status, setCurrentUser, login, register, logout }),
    [user, status, setCurrentUser, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within <AuthProvider>");
  return context;
}