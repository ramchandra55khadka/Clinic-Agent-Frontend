import { SchedulesView } from "@/components/schedules/schedules-view";
import { requireRole } from "@/lib/auth-server";
import { CLINIC_STAFF_ROLES } from "@/lib/roles";

export const metadata = {
  title: "Doctors & schedules",
};

/**
 * Doctors and their availability are maintained by clinic staff or an admin;
 * patients are sent to `/forbidden`. The backend enforces the same rule.
 */
export default async function SchedulesPage() {
  await requireRole("/schedules", CLINIC_STAFF_ROLES);
  return <SchedulesView />;
}