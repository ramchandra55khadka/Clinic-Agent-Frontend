"use client";

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { useMounted } from "@/lib/use-mounted";
import { IconAlertCircle, IconCheckCircle, IconInfo, IconX } from "@/components/icons";

export type ToastTone = "success" | "error" | "info";

export type ToastItem = {
  id: number;
  tone: ToastTone;
  title: string;
  description?: string;
};

const EMPTY: ToastItem[] = [];

let items: ToastItem[] = EMPTY;
let sequence = 0;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emit() {
  items = [...items];
  listeners.forEach((listener) => listener());
}

export function dismissToast(id: number) {
  if (!items.some((item) => item.id === id)) return;
  items = items.filter((item) => item.id !== id);
  emit();
}

type ToastOptions = {
  tone?: ToastTone;
  description?: string;
  /** Milliseconds before auto-dismiss (errors linger longer). */
  duration?: number;
};

function notify(title: string, options: ToastOptions = {}): number {
  const tone = options.tone ?? "info";
  const id = ++sequence;
  items = [...items, { id, tone, title, description: options.description }];
  emit();
  const duration = options.duration ?? (tone === "error" ? 6000 : 4000);
  if (typeof window !== "undefined") {
    window.setTimeout(() => dismissToast(id), duration);
  }
  return id;
}

/**
 * Lightweight transient feedback. Mounted once in the root layout:
 *
 *   toast.success("Appointment confirmed");
 *   toast.error("Could not save", { description: "Try again in a moment." });
 */
export const toast = Object.assign(notify, {
  success: (title: string, options: Omit<ToastOptions, "tone"> = {}) =>
    notify(title, { ...options, tone: "success" }),
  error: (title: string, options: Omit<ToastOptions, "tone"> = {}) =>
    notify(title, { ...options, tone: "error" }),
  info: (title: string, options: Omit<ToastOptions, "tone"> = {}) =>
    notify(title, { ...options, tone: "info" }),
});

const TONES = {
  success: {
    icon: IconCheckCircle,
    iconClass: "text-emerald-600 dark:text-emerald-400",
  },
  error: {
    icon: IconAlertCircle,
    iconClass: "text-red-600 dark:text-red-400",
  },
  info: {
    icon: IconInfo,
    iconClass: "text-brand-600 dark:text-brand-300",
  },
} as const;

/** Bottom-right notification stack; rendered from the root layout. */
export function Toaster() {
  const current = useSyncExternalStore(subscribe, () => items, () => EMPTY);
  const mounted = useMounted();
  if (!mounted) return null;

  return createPortal(
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[70] flex flex-col items-stretch gap-2 p-4 sm:inset-x-auto sm:right-0 sm:bottom-0 sm:w-full sm:max-w-sm sm:p-6"
    >
      {current.map((item) => {
        const { icon: Icon, iconClass } = TONES[item.tone];
        return (
          <div
            key={item.id}
            role={item.tone === "error" ? "alert" : "status"}
            className="toast-in pointer-events-auto flex items-start gap-3 rounded-xl border border-line bg-surface p-3.5 shadow-lg"
          >
            <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", iconClass)} aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{item.title}</p>
              {item.description && (
                <p className="mt-0.5 text-xs text-muted">{item.description}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismissToast(item.id)}
              aria-label="Dismiss notification"
              className="-m-1 rounded-md p-1 text-muted transition hover:text-foreground"
            >
              <IconX className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>,
    document.body,
  );
}
