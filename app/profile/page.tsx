import type { Metadata } from "next";

import { ProfileView } from "@/components/profile/profile-view";
import { requireSession } from "@/lib/auth-server";

export const metadata: Metadata = {
  title: "Profile",
};

export default async function ProfilePage() {
  await requireSession("/profile");
  return <ProfileView />;
}
