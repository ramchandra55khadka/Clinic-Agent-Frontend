import { ChatWorkspace } from "@/components/chat/chat-workspace";

/**
 * The chat assistant is guest-viewable on purpose: a signed-out visitor can
 * read the welcome message and type, and pressing Send bounces them to
 * `/login?next=…` (see `ensureSignedIn` in `ChatWorkspace`). Protected pages
 * like /availability keep their server-side `requireSession` guards.
 */
export default function HomePage() {
  return <ChatWorkspace />;
}
