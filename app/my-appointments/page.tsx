import { MyAppointmentsView } from "@/components/my-appointments/my-appointments-view";
import { requireSession } from "@/lib/auth-server";

export const metadata = {
  title: "My appointments",
};

export default async function MyAppointmentsPage() {
  await requireSession("/my-appointments");
  return <MyAppointmentsView />;
}