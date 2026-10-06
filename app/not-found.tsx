import Link from "next/link";

import { Card, EmptyState } from "@/components/ui";
import { IconInfo } from "@/components/icons";

export default function NotFound() {
  return (
    <div className="mx-auto w-full max-w-md px-4 py-12 sm:px-6">
      <Card title="Page not found" subtitle="The page you requested does not exist.">
        <EmptyState
          icon={<IconInfo className="h-5 w-5" />}
          title="Nothing here"
          description="The link may be outdated, or the page may have moved."
          action={
            <Link href="/" className="text-sm font-medium text-brand-700 underline-offset-2 hover:underline dark:text-brand-200">
              Back to the chat
            </Link>
          }
        />
      </Card>
    </div>
  );
}
