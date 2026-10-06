"use client";

import { IconMonitor, IconMoon, IconSun } from "@/components/icons";
import { useTheme, type ThemePreference } from "@/components/theme-provider";
import { cn } from "@/lib/utils";

const META: Record<
  ThemePreference,
  { icon: typeof IconSun; label: string; next: ThemePreference }
> = {
  light: { icon: IconSun, label: "Light", next: "dark" },
  dark: { icon: IconMoon, label: "Dark", next: "system" },
  system: { icon: IconMonitor, label: "System", next: "light" },
};

/**
 * Cycles light → dark → system. The icon matches the active mode and the
 * accessible name announces both the current mode and what a press does.
 *
 * The button deliberately renders the exact same attributes on the server and
 * the first client render (no `mounted`-gated `disabled`): mount state must
 * never reach server-rendered markup or hydration reports a mismatch that
 * React won't patch up. Clicks before hydration are inert anyway, so gating
 * `disabled` on `mounted` buys nothing.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();

  const meta = META[theme];
  const Icon = meta.icon;
  const next = META[meta.next];

  return (
    <button
      type="button"
      onClick={() => setTheme(meta.next)}
      aria-label={`Theme: ${meta.label}. Activate to switch to ${next.label.toLowerCase()}.`}
      title={`Theme: ${meta.label}`}
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-lg text-muted transition hover:bg-surface-muted hover:text-foreground touch-target",
        className,
      )}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}
