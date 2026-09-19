import type { Metadata } from "next";
import Link from "next/link";

import { Button, Card } from "@/components/ui";
import { IconShieldCheck } from "@/components/icons";
import { getSessionUser } from "@/lib/auth-server";
import { roleLabel } from "@/lib/roles";

export const metadata: Metadata = {
  title: "No access",
};

/** Friendly label for a page path, used in the explanation. */
const PAGE_LABELS: Record<string, string> = {
  "/schedules": "Doctors & schedules",
  "/appointments": "Appointments",
  "/users": "Team & accounts",
};

/**
 * Shown when a signed-in user opens a page their role does not cover. The
 * backend refuses the underlying API calls either way — this page only explains
 * the situation instead of rendering a broken screen.
 */
export default async function ForbiddenPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const raw = Array.isArray(params.from) ? params.from[0] : params.from;
  const from = raw && raw.startsWith("/") ? raw : null;
  const user = await getSessionUser();

  return (
    <main className="page-shell">
      <Card className="mx-auto max-w-xl">
        <div className="flex flex-col items-center py-6 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300">
            <IconShieldCheck className="h-5 w-5" />
          </span>

          <h1 className="mt-4 text-lg font-semibold tracking-tight">You don&apos;t have access</h1>

          <p className="mt-2 max-w-md text-sm text-muted">
            {from ? (
              <>
                <span className="font-medium text-foreground">
                  {PAGE_LABELS[from] ?? from}
                </span>{" "}
                is available to clinic staff only.
              </>
            ) : (
              "This page is available to clinic staff only."
            )}
            {user && (
              <>
                {" "}
                You are signed in as{" "}
                <span className="font-medium text-foreground">{roleLabel(user.role)}</span>.
              </>
            )}
          </p>

          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
            >
              Back to the assistant
            </Link>
            <Link href="/my-appointments">
              <Button variant="secondary">My appointments</Button>
            </Link>
          </div>

          <p className="mt-5 max-w-sm text-xs text-muted">
            Need staff access? Ask a clinic administrator to update your role.
          </p>
        </div>
      </Card>
    </main>
  );
}