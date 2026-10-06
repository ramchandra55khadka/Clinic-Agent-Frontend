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
  IconMenu,
  IconSettings,
  IconShieldCheck,
  IconStethoscope,
  IconX,
  LogoMark,
} from "@/components/icons";
import { Avatar, Badge, buttonClass } from "@/components/ui";
import { ThemeToggle } from "@/components/theme-toggle";
import { ADMIN_ROLES, CLINIC_STAFF_ROLES, PATIENT_ROLE, STAFF_ROLE, roleLabel } from "@/lib/roles";
import type { UserRole } from "@/lib/types";
import { cn, displayName } from "@/lib/utils";

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
  { href: "/doctor", label: "Doctors", icon: IconStethoscope, roles: CLINIC_STAFF_ROLES },
  { href: "/appointments", label: "Appointments", icon: IconCalendarDays, roles: CLINIC_STAFF_ROLES },
  { href: "/users", label: "Team", icon: IconShieldCheck, roles: ADMIN_ROLES },
];

/** Standard top navigation: brand, icon nav, account menu. */
export function SiteHeader() {
  const pathname = usePathname();
  const { user, status: sessionStatus, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const mobileNavRef = useRef<HTMLDivElement>(null);

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

  /* Close mobile nav on outside click or Escape. */
  useEffect(() => {
    if (!mobileNavOpen) return;
    function onPointerDown(event: PointerEvent) {
      if (!mobileNavRef.current?.contains(event.target as Node)) setMobileNavOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMobileNavOpen(false);
    }
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [mobileNavOpen]);

  const authenticated = sessionStatus === "authenticated" && user !== null;

  const filteredNavItems = authenticated && user
    ? NAV_ITEMS.filter((item) => item.roles.includes(user.role as UserRole))
    : [];

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-surface/85 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <LogoMark className="h-8 w-8" />
          <span className="flex flex-col leading-tight">
            <span className="text-sm font-semibold tracking-tight">Nishant Care</span>
            <span className="text-2xs text-muted">Private clinic assistant</span>
          </span>
        </Link>

        {/* Mobile menu button */}
        <button
          type="button"
          onClick={() => setMobileNavOpen((open) => !open)}
          aria-expanded={mobileNavOpen}
          aria-controls="mobile-nav"
          aria-label={mobileNavOpen ? "Close navigation" : "Open navigation"}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-muted transition hover:bg-surface-muted hover:text-foreground lg:hidden"
        >
          {mobileNavOpen ? <IconX className="h-5 w-5" /> : <IconMenu className="h-5 w-5" />}
        </button>

        {/* Desktop navigation */}
        {authenticated && user ? (
          <nav
            aria-label="Main"
            className="scroll-thin order-3 -mx-1 flex w-full items-center gap-1 overflow-x-auto px-1 pb-1 sm:order-none sm:w-auto sm:flex-1 sm:pb-0 lg:order-none"
          >
            {filteredNavItems.map((item) => {
              const active =
                item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileNavOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition touch-target",
                    active
                      ? "bg-accent-50 font-medium text-accent-600 dark:bg-accent-600/20 dark:text-accent-100"
                      : "text-muted hover:bg-surface-muted hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        ) : (
          <span className="flex-1" />
        )}

        <div className="flex items-center gap-2">
          <ThemeToggle />
          {authenticated && user ? (
            <div ref={menuRef} className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                className="flex items-center gap-2 rounded-full border border-line py-1 pl-1 pr-2 transition hover:bg-surface-muted touch-target"
              >
                <Avatar name={displayName(user)} imageUrl={user.photo_url} className="h-7 w-7 text-3xs" />
                <span className="hidden max-w-28 truncate text-xs font-medium sm:block">
                  {displayName(user)}
                </span>
                <IconChevronDown className="h-3.5 w-3.5 text-muted" />
              </button>

              {menuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-[calc(100%+8px)] w-64 rounded-lg border border-line bg-surface p-2 shadow-lg"
                >
                  <div className="rounded-lg px-3 py-2.5">
                    <div className="flex items-center gap-3">
                      <Avatar name={displayName(user)} imageUrl={user.photo_url} className="h-10 w-10" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{displayName(user)}</p>
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
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground transition hover:bg-surface-muted touch-target"
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
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40 touch-target"
                  >
                    <IconLogout className="h-4 w-4" />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          ) : sessionStatus === "loading" ? (
            <span className="text-2xs text-muted">Checking session…</span>
          ) : (
            <Link href="/login" className={buttonClass("primary", "sm")}>
              Sign in
            </Link>
          )}
        </div>
      </div>

      {/* Mobile navigation drawer */}
      {mobileNavOpen && (
        <>
          <div
            className="drawer-backdrop lg:hidden"
            onClick={() => setMobileNavOpen(false)}
            aria-hidden="true"
          />
          <nav
            id="mobile-nav"
            ref={mobileNavRef}
            aria-label="Mobile navigation"
            className="drawer lg:hidden"
          >
            <div className="flex h-full flex-col">
              <div className="border-b border-line p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">Navigation</span>
                  <div className="flex items-center gap-1">
                    <ThemeToggle />
                    <button
                      type="button"
                      onClick={() => setMobileNavOpen(false)}
                      aria-label="Close navigation"
                      className="flex h-10 w-10 items-center justify-center rounded-lg text-muted transition hover:bg-surface-muted"
                    >
                      <IconX className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-1">
                {filteredNavItems.map((item) => {
                  const active =
                    item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileNavOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-3 text-base transition touch-target",
                        active
                          ? "bg-accent-50 font-medium text-accent-600 dark:bg-accent-600/20 dark:text-accent-100"
                          : "text-muted hover:bg-surface-muted hover:text-foreground",
                      )}
                    >
                      <Icon className="h-5 w-5 shrink-0" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
              {sessionStatus === "loading" ? (
                <div className="border-t border-line p-4 text-center text-sm text-muted">
                  Checking session…
                </div>
              ) : !authenticated ? (
                <div className="border-t border-line p-4">
                  <Link
                    href="/login"
                    onClick={() => setMobileNavOpen(false)}
                    className={buttonClass("primary", "md", "w-full")}
                  >
                    Sign in
                  </Link>
                </div>
              ) : null}
            </div>
          </nav>
        </>
      )}
    </header>
  );
}
