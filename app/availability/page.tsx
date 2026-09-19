import { AvailabilityView } from "@/components/availability/availability-view";
import { requireSession } from "@/lib/auth-server";

export const metadata = {
  title: "Availability",
};

export default async function AvailabilityPage() {
  await requireSession("/availability");
  return <AvailabilityView />;
}