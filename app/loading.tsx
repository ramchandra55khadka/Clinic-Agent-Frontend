import { PageHeader, Skeleton } from "@/components/ui";

/** Route-level loading state: keeps the page frame steady while data streams. */
export default function Loading() {
  return (
    <main className="page-shell" aria-busy="true">
      <PageHeader title={<Skeleton className="h-7 w-48" />} description={<Skeleton className="mt-2 h-4 w-72" />} />
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
      <Skeleton className="mt-5 h-64" />
    </main>
  );
}
