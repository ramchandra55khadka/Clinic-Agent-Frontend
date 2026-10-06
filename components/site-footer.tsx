"use client";

import { useEffect, useState } from "react";

import { getHealth } from "@/lib/api";
import { cn } from "@/lib/utils";

type Status = "checking" | "online" | "offline";

const LABELS: Record<Status, { dot: string; text: string }> = {
  checking: { dot: "bg-amber-400", text: "Checking services…" },
  online: { dot: "bg-emerald-500", text: "All systems operational" },
  offline: { dot: "bg-red-500", text: "Service disruption" },
};

/**
 * Standard product footer with a light-touch service status indicator.
 * The health probe mirrors the browser status bar convention — visible but
 * never in the way of the primary workflows.
 */
export function SiteFooter() {
  const [status, setStatus] = useState<Status>("checking");

  useEffect(() => {
    let active = true;
    async function ping() {
      try {
        await getHealth();
        if (active) setStatus("online");
      } catch {
        if (active) setStatus("offline");
      }
    }
    void ping();
    const timer = window.setInterval(ping, 60_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  const label = LABELS[status];

  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-3 px-4 py-4 text-xs text-muted sm:flex-row sm:px-6 sm:gap-4">
        <p className="text-center sm:text-left">© 2026 Nishant Care · Chat-first appointment booking</p>
        <p className="inline-flex items-center gap-2 whitespace-nowrap">
          <span className={cn("h-1.5 w-1.5 rounded-full flex-shrink-0", label.dot)} />
          {label.text}
        </p>
      </div>
    </footer>
  );
}
