"use client";

import { useCallback, useContext, useEffect, useMemo, useSyncExternalStore } from "react";
import { createContext } from "react";

export type ThemePreference = "light" | "dark" | "system";

const STORAGE_KEY = "nishant-care-theme";
const DARK_QUERY = "(prefers-color-scheme: dark)";

type ThemeContextValue = {
  /** What the user picked. */
  theme: ThemePreference;
  /** What is actually painted right now. */
  resolved: "light" | "dark";
  setTheme: (next: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

/* ------------------------------------------------------------------ */
/* External store: the preference lives in localStorage so it survives  */
/* reloads; listeners cover cross-tab sync plus React's own notify.     */
/* ------------------------------------------------------------------ */

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

function readStoredTheme(): ThemePreference {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === "light" || raw === "dark" || raw === "system") return raw;
  } catch {
    // Storage may be unavailable in private browsing.
  }
  return "system";
}

function subscribeTheme(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === STORAGE_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function subscribeSystem(listener: () => void) {
  const media = window.matchMedia(DARK_QUERY);
  media.addEventListener("change", listener);
  return () => media.removeEventListener("change", listener);
}

function prefersDark(): boolean {
  return window.matchMedia(DARK_QUERY).matches;
}

function resolve(theme: ThemePreference, systemDark: boolean): "light" | "dark" {
  if (theme === "system") return systemDark ? "dark" : "light";
  return theme;
}

/**
 * Owns the light/dark/system choice. The initial class is applied before
 * first paint by the inline script in app/layout.tsx; this provider keeps the
 * document class in sync afterwards. State is an external store so values are
 * correct from the first client render (no post-hydration flicker).
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore(subscribeTheme, readStoredTheme, () => "system" as const);
  const systemDark = useSyncExternalStore(subscribeSystem, prefersDark, () => false);
  const resolved = resolve(theme, systemDark);

  // External system sync: the DOM class is the source of truth for CSS.
  useEffect(() => {
    document.documentElement.classList.toggle("dark", resolved === "dark");
  }, [resolved]);

  const setTheme = useCallback((next: ThemePreference) => {
    try {
      if (next === "system") window.localStorage.removeItem(STORAGE_KEY);
      else window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage may be unavailable; the in-memory choice still applies.
    }
    const systemDarkNow = prefersDark();
    document.documentElement.classList.toggle("dark", resolve(next, systemDarkNow) === "dark");
    notify();
  }, []);

  const value = useMemo(() => ({ theme, resolved, setTheme }), [theme, resolved, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside <ThemeProvider>");
  return context;
}
