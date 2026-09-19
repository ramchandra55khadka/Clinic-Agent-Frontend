"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { useAuth } from "@/components/auth/auth-provider";
import {
  IconCalendarCheck,
  IconCalendarDays,
  IconChat,
  IconChevronDown,
  IconClock,
  IconLogout,
  IconSettings,
  IconShieldCheck,
  IconStethoscope,
  LogoMark,
} from "@/components/icons";
import { Avatar, Badge } from "@/components/ui";
import { ADMIN_ROLES, CLINIC_STAFF_ROLES, PATIENT_ROLE, STAFF_ROLE, roleLabel } from "@/lib/roles";
import type { UserRole } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Navigation, filtered by role. Patients see their own journey; clinic staff and
 * admins additionally see the pages they maintain. Hiding an item is only
 * convenience — each page re-checks the role on the server and the backend
 * refuses the API calls regardless.
 */
const PATIENT_AND_STAFF_ROLES: readonly UserRole[] = [PATIENT_ROLE, STAFF_ROLE];

const NAV_ITEMS: ReadonlyArray<{
  href: string;
  label: string;
  icon: typeof IconChat;
  roles: readonly UserRole[];
}> = [
  { href: "/", label: "Chat", icon: IconChat, roles: PATIENT_AND_STAFF_ROLES },
  { href: "/availability", label: "Availability", icon: IconClock, roles: PATIENT_AND_STAFF_ROLES },
  { href: "/my-appointments", label: "My appointments", icon: IconCalendarCheck, roles: PATIENT_AND_STAFF_ROLES },
  { href: "/schedules", label: "Doctors", icon: IconStethoscope, roles: CLINIC_STAFF_ROLES },
  { href: "/appointments", label: "Appointments", icon: IconCalendarDays, roles: CLINIC_STAFF_ROLES },
  { href: "/users", label: "Team", icon: IconShieldCheck, roles: ADMIN_ROLES },
];

/** Standard top navigation: brand, icon nav, account menu. */
export function SiteHeader() {
  const pathname = usePathname();
  const { user, status: sessionStatus, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  /* Close the account menu on outside click or Escape. */
  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  const authenticated = sessionStatus === "authenticated" && user !== null;

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-surface/85 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <LogoMark className="h-8 w-8" />
          <span className="flex flex-col leading-tight">
            <span className="text-sm font-semibold tracking-tight">Nishant Care</span>
            <span className="text-[11px] text-muted">Private clinic assistant</span>
          </span>
        </Link>

        {authenticated && user ? (
          <nav
            aria-label="Main"
            className="scroll-thin order-3 -mx-1 flex w-full items-center gap-1 overflow-x-auto px-1 pb-1 sm:order-none sm:w-auto sm:flex-1 sm:pb-0"
          >
            {NAV_ITEMS.filter((item) => item.roles.includes(user.role as UserRole)).map(
              (item) => {
                const active =
                  item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition",
                      active
                        ? "bg-accent-50 font-medium text-accent-600 dark:bg-accent-600/20 dark:text-accent-100"
                        : "text-muted hover:bg-surface-muted hover:text-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              },
            )}
          </nav>
        ) : (
          <span className="flex-1" />
        )}

        <div className="flex items-center gap-2">
          {authenticated && user ? (
            <div ref={menuRef} className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                className="flex items-center gap-2 rounded-full border border-line py-1 pl-1 pr-2 transition hover:bg-surface-muted"
              >
                <Avatar name={user.full_name} imageUrl={user.profile_photo_url} className="h-7 w-7 text-[10px]" />
                <span className="hidden max-w-28 truncate text-xs font-medium sm:block">
                  {user.full_name}
                </span>
                <IconChevronDown className="h-3.5 w-3.5 text-muted" />
              </button>

              {menuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-[calc(100%+8px)] w-64 rounded-2xl border border-line bg-surface p-2 shadow-lg"
                >
                  <div className="rounded-xl px-3 py-2.5">
                    <div className="flex items-center gap-3">
                      <Avatar name={user.full_name} imageUrl={user.profile_photo_url} className="h-10 w-10" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{user.full_name}</p>
                    <p className="mt-0.5 truncate text-xs text-muted">{user.email}</p>
                    <Badge tone="brand" className="mt-2">
                          {roleLabel(user.role)}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="my-1 border-t border-line" />
                  <Link
                    href="/profile"
                    role="menuitem"
                    onClick={() => setMenuOpen(false)}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-foreground transition hover:bg-surface-muted"
                  >
                    <IconSettings className="h-4 w-4" />
                    Edit profile
                  </Link>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      void logout();
                    }}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                  >
                    <IconLogout className="h-4 w-4" />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          ) : sessionStatus === "loading" ? (
            <span className="text-[11px] text-muted">Checking session…</span>
          ) : (
            <Link
              href="/login"
              className="inline-flex items-center rounded-xl bg-accent-600 px-3.5 py-1.5 text-xs font-medium text-white transition hover:bg-accent-600/90"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
