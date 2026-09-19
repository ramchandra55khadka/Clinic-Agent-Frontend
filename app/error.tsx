"use client";

import { useRouter } from "next/navigation";

import { Alert, Button } from "@/components/ui";

/**
 * Route-level error boundary.
 *
 * Only a generic message and the server-generated digest are shown — error
 * details stay in the server logs, keyed by the request id.
 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
      <Alert tone="danger">
        <p className="font-medium">Something went wrong.</p>
        <p className="mt-1">
          An unexpected error occurred while rendering this page.
          {error.digest ? ` Reference: ${error.digest}.` : ""}
        </p>
      </Alert>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={reset}>Try again</Button>
        <Button variant="secondary" onClick={() => router.push("/")}>
          Back to the chat
        </Button>
      </div>
    </div>
  );
}