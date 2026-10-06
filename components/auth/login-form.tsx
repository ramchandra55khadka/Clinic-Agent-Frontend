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
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
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
    if (mode === "signup" && !firstName.trim()) issues.push("first name");
    if (mode === "signup" && !lastName.trim()) issues.push("last name");
    if (!isValidEmail(email)) issues.push("valid email");
    if (mode === "signup" && !phone.trim()) {
      issues.push("phone");
    } else if (mode === "signup" && phone.trim().length < 7) {
      issues.push("phone (min 7 digits)");
    }
    if (password.length < 8) issues.push("password (min 8 characters)");
    if (mode === "signup" && confirmPassword !== password) {
      issues.push("passwords do not match");
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
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: email.trim(),
          password,
          phone: phone.trim(),
        };
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
    <div className="flex w-full flex-1 lg:grid lg:grid-cols-2 min-h-[calc(100vh-112px)]">
      {/* Brand panel — desktop only */}
      <aside className="relative hidden overflow-hidden bg-brand-700 lg:block">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-br from-brand-600 via-brand-700 to-accent-600"
        />
        <div className="relative flex h-full flex-col justify-between p-6 sm:p-10 text-white">
          <div className="flex items-center gap-2.5">
            <LogoMark className="h-9 w-9" />
            <span className="text-sm font-semibold tracking-tight">Nishant Care</span>
          </div>

          <div className="max-w-md">
            <h2 className="text-2xl sm:text-3xl font-semibold leading-tight tracking-tight">
              Your care, without the waiting room.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-brand-100">
              Our assistant helps you find the right doctor, check opening times and book an
              appointment — in under a minute.
            </p>
            <ul className="mt-6 sm:mt-8 space-y-3">
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
      <div className="flex items-center justify-center px-4 py-8 sm:px-6 lg:py-12">
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
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="First name" htmlFor="first_name" required>
                  <TextInput
                    id="first_name"
                    name="first_name"
                    autoComplete="given-name"
                    value={firstName}
                    onChange={(event) => setFirstName(event.target.value)}
                    placeholder="Sita"
                    required
                  />
                </Field>
                <Field label="Last name" htmlFor="last_name" required>
                  <TextInput
                    id="last_name"
                    name="last_name"
                    autoComplete="family-name"
                    value={lastName}
                    onChange={(event) => setLastName(event.target.value)}
                    placeholder="Sharma"
                    required
                  />
                </Field>
              </div>
            )}

            <Field label="Email" htmlFor="email" required>
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
              <Field label="Phone" htmlFor="phone" required>
                <TextInput
                  id="phone"
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="9800000000"
                  required
                />
              </Field>
            )}

            <Field label="Password" hint="min 8 characters" htmlFor="password" required>
              <TextInput
                id="password"
                name="password"
                type="password"
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                required
                showPasswordToggle
              />
            </Field>

            {mode === "signup" && (
              <Field label="Confirm password" htmlFor="confirm_password" required>
                <TextInput
                  id="confirm_password"
                  name="confirm_password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="••••••••"
                  required
                  showPasswordToggle
                />
              </Field>
            )}

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

            <p className="text-center text-2xs leading-relaxed text-muted">
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
