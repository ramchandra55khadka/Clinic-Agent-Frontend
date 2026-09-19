import { AppointmentsView } from "@/components/appointments/appointments-view";
import { requireRole } from "@/lib/auth-server";
import { CLINIC_STAFF_ROLES } from "@/lib/roles";

export const metadata = {
  title: "Appointments",
};

/** Clinic-wide appointment list: staff and admins (patients use `/my-appointments`). */
export default async function AppointmentsPage() {
  await requireRole("/appointments", CLINIC_STAFF_ROLES);
  return <AppointmentsView />;
}