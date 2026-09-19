import Link from "next/link";

import { Card } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="mx-auto w-full max-w-md px-4 py-12 sm:px-6">
      <Card title="Page not found" subtitle="The page you requested does not exist.">
        <Link
          href="/"
          className="text-sm font-medium text-brand-700 underline-offset-2 hover:underline dark:text-brand-200"
        >
          Back to the chat
        </Link>
      </Card>
    </div>
  );
}