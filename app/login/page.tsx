import type { Metadata } from "next";

import { LoginForm } from "@/components/auth/login-form";
import { getSessionUser } from "@/lib/auth-server";

export const metadata: Metadata = {
  title: "Sign in",
};

/**
 * Only same-origin, absolute paths are accepted as post-login destinations, so
 * `?next=` can never be used to bounce a visitor to another site.
 */
function safeNext(value: string | string[] | undefined): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//")) return "/";
  return candidate;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const nextPath = safeNext(params.next);

  // Redirect signed-in visitors away from the form (also keeps the header in
  // sync when a session exists but the page was opened directly).
  const user = await getSessionUser();

  return <LoginForm nextPath={nextPath} expired={params.reason === "expired" && !user} />;
}