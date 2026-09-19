"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { useAuth } from "@/components/auth/auth-provider";
import { IconClock, IconMail, IconSparkles, LogoMark } from "@/components/icons";
import { Alert, Button, Field, TextInput } from "@/components/ui";
import type { RegisterInput } from "@/lib/types";
import { errorMessage, isValidEmail } from "@/lib/utils";

type Mode = "signin" | "signup";

const HEADINGS: Record<Mode, { title: string; subtitle: string; submit: string }> = {
  signin: {
    title: "Welcome back",
    subtitle: "Sign in to manage your appointments.",
    submit: "Sign in",
  },
  signup: {
    title: "Create your account",
    subtitle: "Book appointments and chat with our assistant in minutes.",
    submit: "Create account",
  },
};

const BENEFITS = [
  { icon: IconSparkles, text: "Ask our assistant about any doctor" },
  { icon: IconClock, text: "See live availability before you book" },
  { icon: IconMail, text: "Get a confirmation straight to your inbox" },
] as const;

/** Split-panel sign-in / registration; credentials go to `/api/session/*`. */
export function LoginForm({ nextPath, expired }: { nextPath: string; expired: boolean }) {
  const router = useRouter();
  const { login, register, status } = useAuth();

  const [mode, setMode] = useState<Mode>("signin");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  /* Already signed in (back button, bookmark, …): go straight to the app. */
  useEffect(() => {
    if (status === "authenticated") router.replace(nextPath);
  }, [status, router, nextPath]);

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
  }

  function problems(): string[] {
    const issues: string[] = [];
    if (mode === "signup" && fullName.trim().length < 2) {
      issues.push("full name (min 2 characters)");
    }
    if (!isValidEmail(email)) issues.push("valid email");
    if (password.length < 8) issues.push("password (min 8 characters)");
    if (mode === "signup" && phone.trim() && phone.trim().length < 7) {
      issues.push("phone (min 7 digits)");
    }
    return issues;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const issues = problems();
    if (issues.length > 0) {
      setError(`Please check: ${issues.join(", ")}.`);
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      if (mode === "signin") {
        await login({ email: email.trim(), password });
      } else {
        const payload: RegisterInput = {
          full_name: fullName.trim(),
          email: email.trim(),
          password,
        };
        if (phone.trim()) payload.phone = phone.trim();
        await register(payload);
      }
      router.replace(nextPath);
    } catch (cause) {
      setError(errorMessage(cause));
      setSubmitting(false);
    }
  }

  const heading = HEADINGS[mode];

  return (
    <div className="flex w-full flex-1 lg:grid lg:grid-cols-2">
      {/* Brand panel — desktop only */}
      <aside className="relative hidden overflow-hidden bg-brand-700 lg:block">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-br from-brand-600 via-brand-700 to-accent-600"
        />
        <div className="relative flex h-full flex-col justify-between p-10 text-white">
          <div className="flex items-center gap-2.5">
            <LogoMark className="h-9 w-9" />
            <span className="text-sm font-semibold tracking-tight">Nishant Care</span>
          </div>

          <div className="max-w-md">
            <h2 className="text-3xl font-semibold leading-tight tracking-tight">
              Your care, without the waiting room.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-brand-100">
              Our assistant helps you find the right doctor, check opening times and book an
              appointment — in under a minute.
            </p>
            <ul className="mt-8 space-y-3">
              {BENEFITS.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-3 text-sm text-brand-50">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/15">
                    <Icon className="h-4 w-4" />
                  </span>
                  {text}
                </li>
              ))}
            </ul>
          </div>

          <p className="text-xs text-brand-200">Open Mon–Sat · 9:00–17:00</p>
        </div>
      </aside>

      {/* Form panel */}
      <div className="flex items-center justify-center px-4 py-12 sm:px-6">
        <div className="w-full max-w-md">
          <div className="mb-6 flex items-center gap-2.5 lg:hidden">
            <LogoMark className="h-8 w-8" />
            <span className="text-sm font-semibold tracking-tight">Nishant Care</span>
          </div>

          <h1 className="text-2xl font-semibold tracking-tight">{heading.title}</h1>
          <p className="mt-1 text-sm text-muted">{heading.subtitle}</p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
            {expired && (
              <Alert tone="warning">Your session expired. Please sign in again.</Alert>
            )}
            {error && <Alert tone="danger">{error}</Alert>}

            {mode === "signup" && (
              <Field label="Full name" htmlFor="full_name">
                <TextInput
                  id="full_name"
                  name="full_name"
                  autoComplete="name"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="Sita Sharma"
                  required
                />
              </Field>
            )}

            <Field label="Email" htmlFor="email">
              <TextInput
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                required
              />
            </Field>

            {mode === "signup" && (
              <Field label="Phone" hint="optional" htmlFor="phone">
                <TextInput
                  id="phone"
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="9800000000"
                />
              </Field>
            )}

            <Field label="Password" hint="min 8 characters" htmlFor="password">
              <TextInput
                id="password"
                name="password"
                type="password"
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                required
              />
            </Field>

            <Button type="submit" className="w-full" loading={submitting}>
              {heading.submit}
            </Button>

            <p className="text-center text-xs text-muted">
              {mode === "signin" ? "New to Nishant Care?" : "Already registered?"}{" "}
              <button
                type="button"
                className="font-medium text-brand-700 underline-offset-2 hover:underline dark:text-brand-200"
                onClick={() => switchMode(mode === "signin" ? "signup" : "signin")}
              >
                {mode === "signin" ? "Create an account" : "Sign in"}
              </button>
            </p>

            <p className="text-center text-[11px] leading-relaxed text-muted">
              {mode === "signin"
                ? "Clinic staff and administrators: use the credentials issued by your clinic administrator."
                : "Creating an account signs you up as a patient. Clinic staff accounts are issued by an administrator."}
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
