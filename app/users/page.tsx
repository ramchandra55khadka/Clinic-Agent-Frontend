import { UsersView } from "@/components/users/users-view";
import { requireRole } from "@/lib/auth-server";
import { ADMIN_ROLES } from "@/lib/roles";

export const metadata = {
  title: "Team & accounts",
};

/** Account management is admin-only; the backend enforces the same rule. */
export default async function UsersPage() {
  await requireRole("/users", ADMIN_ROLES);
  return <UsersView />;
}