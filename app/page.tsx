import { ChatWorkspace } from "@/components/chat/chat-workspace";
import { requireSession } from "@/lib/auth-server";

export default async function HomePage() {
  await requireSession("/");
  return <ChatWorkspace />;
}
