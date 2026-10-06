"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/components/auth/auth-provider";
import { Composer } from "@/components/chat/composer";
import { ConversationList } from "@/components/chat/conversation-list";
import { ChatBubble, TypingBubble } from "@/components/chat/message";
import { Button } from "@/components/ui";
import { IconChevronLeft, IconMessageSquare } from "@/components/icons";
import {
  cancelChatBooking,
  chat,
  confirmChatBooking,
  deleteConversation,
  getConversation,
  listConversations,
  renameConversation,
} from "@/lib/api";
import type {
  ChatMessage,
  ChatRequest,
  ConversationSummary,
  ConversationTurn,
  Slot,
} from "@/lib/types";
import { cn, createId, errorMessage, formatTime } from "@/lib/utils";
import { refreshSession } from "@/lib/session";

const WELCOME_MESSAGE: ChatMessage = {
  id: "welcome",
  role: "assistant",
  intent: "fallback",
  text: `Namaste, welcome to Nishant Care.

I can help you learn about our doctors, check availability, and book an appointment here in chat. Tell me what you need, for example: "Book an appointment tomorrow at 10 AM."`,
};

const PAGE_SIZE = 200;

/**
 * Only the *pointer* to the active thread is cached locally — the transcript
 * itself always comes from the backend. That keeps this component from being a
 * second, divergent source of truth for conversation memory.
 */
function storageKey(userId: string): string {
  return `nishant-care-chat:${userId}`;
}

function turnToMessage(turn: ConversationTurn): ChatMessage {
  return {
    id: `turn-${turn.id}`,
    role: turn.role,
    text: turn.content,
    intent: turn.intent ?? undefined,
  };
}

export function ChatWorkspace() {
  const { user, status, setCurrentUser } = useAuth();
  const router = useRouter();
  const userId = user?.id ?? "anonymous";

  const [threads, setThreads] = useState<ConversationSummary[]>([]);
  const [threadsLoading, setThreadsLoading] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [olderCount, setOlderCount] = useState(0);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sessionRestored, setSessionRestored] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  /** Distance from the bottom to restore after older turns are prepended. */
  const scrollAnchorRef = useRef<number | null>(null);
  /** In-flight reply, so the Stop button can abort it mid-generation. */
  const abortRef = useRef<AbortController | null>(null);

  const refreshThreads = useCallback(async () => {
    try {
      const response = await listConversations();
      setThreads(response.conversations ?? []);
    } catch (error) {
      console.error("Could not load conversations", error);
    } finally {
      setThreadsLoading(false);
    }
  }, []);

  /** Replay a thread from the backend into the message list. */
  const loadThread = useCallback(async (targetSessionId: string) => {
    setMessages([WELCOME_MESSAGE]);
    setOlderCount(0);
    try {
      const detail = await getConversation(targetSessionId, { limit: PAGE_SIZE });
      const replayed = detail.messages.map(turnToMessage);
      setMessages(replayed.length > 0 ? replayed : [WELCOME_MESSAGE]);
      setOlderCount(detail.has_more ? detail.message_count - replayed.length : 0);
    } catch (error) {
      // A thread deleted in another tab should not trap the user on a dead id.
      console.error("Could not load conversation", error);
      setMessages([WELCOME_MESSAGE]);
      setSessionId(null);
    }
  }, []);

  // Restore the last active thread once the signed-in user is known.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    async function restore() {
      setSessionRestored(false);
      setThreadsLoading(true);
      try {
        const response = await listConversations();
        if (cancelled) return;
        const available = response.conversations ?? [];
        setThreads(available);

        let stored: string | null | undefined;
        try {
          const raw = window.localStorage.getItem(storageKey(userId));
          if (raw) {
            const parsed = JSON.parse(raw) as { sessionId?: string | null; newChat?: boolean };
            stored = parsed.sessionId ?? (parsed.newChat ? null : undefined);
          }
        } catch {
          // Ignore malformed or unavailable storage.
        }

        if (stored) {
          setSessionId(stored);
          await loadThread(stored);
        } else if (stored === undefined && available[0]) {
          setSessionId(available[0].session_id);
          await loadThread(available[0].session_id);
        }
      } catch (error) {
        console.error("Could not restore conversations", error);
      } finally {
        if (!cancelled) {
          setThreadsLoading(false);
          setSessionRestored(true);
        }
      }
    }

    void restore();
    return () => {
      cancelled = true;
    };
  }, [userId, user, loadThread]);

  useEffect(() => {
    if (!user || !sessionRestored) return;
    try {
      window.localStorage.setItem(
        storageKey(userId),
        JSON.stringify(sessionId ? { sessionId } : { sessionId: null, newChat: true }),
      );
    } catch {
      // Storage may be unavailable in private browsing.
    }
  }, [userId, user, sessionId, sessionRestored]);

  /* A deep link such as `/?prompt=…` (used by the Availability page's
     "Book this slot" action) sends one message as soon as the thread is
     ready, then clears the query so a refresh doesn't repeat it. */
  const promptedRef = useRef(false);
  useEffect(() => {
    if (!sessionRestored || status !== "authenticated" || promptedRef.current) return;
    promptedRef.current = true;

    const params = new URLSearchParams(window.location.search);
    const prompt = params.get("prompt");
    if (!prompt) return;
    params.delete("prompt");
    const query = params.toString();
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`,
    );
    void send(prompt);
    // Runs once, when an authenticated thread is ready; `send` reads fresh state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionRestored, status]);

  // Keep the newest message in view: scroll to the bottom whenever the
  // transcript changes, unless older turns were just prepended — then hold the
  // reader where they were instead of yanking them back down.
  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    const anchor = scrollAnchorRef.current;
    scrollAnchorRef.current = null;
    node.scrollTop = anchor === null ? node.scrollHeight : node.scrollHeight - anchor;
  }, [messages, busy]);

  /* Signed-out visitors keep a usable composer (the restore never finishes for
     them), so "busy" only blocks while an actual session is loading. */
  const chatBusy = busy || (!sessionRestored && status === "authenticated");

  // Close sidebar on mobile when selecting a thread
  const handleSelect = (targetSessionId: string) => {
    if (chatBusy || targetSessionId === sessionId) return;
    setSessionId(targetSessionId);
    void loadThread(targetSessionId);
    setSidebarOpen(false);
  };

  // Close sidebar on mobile when creating new chat
  const handleNew = () => {
    setSessionId(null);
    setMessages([WELCOME_MESSAGE]);
    setOlderCount(0);
    try {
      window.localStorage.setItem(storageKey(userId), JSON.stringify({ sessionId: null, newChat: true }));
    } catch {
      // Ignore storage failures.
    }
    setSidebarOpen(false);
  };

  /**
   * Sending is a signed-in action: an expired access token gets one silent
   * refresh first (the refresh cookie may still be valid), and a real guest is
   * bounced to the login page with `next` pointing back here — including any
   * `?prompt=` deep link — so the trip through the form resumes afterwards.
   */
  async function ensureSignedIn(): Promise<boolean> {
    if (status === "authenticated") return true;

    try {
      const refreshed = await refreshSession();
      if (refreshed) {
        setCurrentUser(refreshed);
        return true;
      }
    } catch {
      // No usable refresh: fall through to the login page.
    }

    const next = `${window.location.pathname}${window.location.search}`;
    void router.replace(`/login?next=${encodeURIComponent(next)}`);
    return false;
  }

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (!(await ensureSignedIn())) return;
    if (chatBusy) return;

    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    setMessages((previous) => [...previous, { id: createId("user"), role: "user", text: trimmed }]);

    const payload: ChatRequest = { session_id: sessionId, message: trimmed };

    try {
      const response = await chat(payload, { signal: controller.signal });
      setSessionId(response.session_id);
      setMessages((previous) => [
        ...previous,
        {
          id: createId("assistant"),
          role: "assistant",
          text: response.response,
          intent: response.intent,
          chunks: response.chunks ?? undefined,
          data: response.data ?? undefined,
        },
      ]);
      // The sidebar title is derived from the first patient message and the
      // ordering is by last activity, so refresh on every turn.
      void refreshThreads();
    } catch (error) {
      if (controller.signal.aborted) {
        // Stop was pressed: the reply never arrived. Note it so the thread
        // still reads coherently, then resync the sidebar — the backend
        // finishes and stores this turn regardless of the client hanging up.
        setMessages((previous) => [
          ...previous,
          { id: createId("stopped"), role: "assistant", text: "Response stopped." },
        ]);
        void refreshThreads();
      } else {
        setMessages((previous) => [
          ...previous,
          { id: createId("error"), role: "assistant", text: errorMessage(error), error: true },
        ]);
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setBusy(false);
    }
  }

  /** Abort the in-flight reply (ChatGPT-style stop). */
  function handleStop() {
    abortRef.current?.abort();
  }

  /** Optimistically retitle the thread, then persist the rename. */
  async function handleRename(targetSessionId: string, title: string) {
    setThreads((previous) =>
      previous.map((thread) => (thread.session_id === targetSessionId ? { ...thread, title } : thread)),
    );
    try {
      const updated = await renameConversation(targetSessionId, title);
      setThreads((previous) =>
        previous.map((thread) => (thread.session_id === targetSessionId ? updated : thread)),
      );
    } catch (error) {
      console.error("Could not rename conversation", error);
      void refreshThreads(); // roll back to the server's copy
    }
  }

  function handlePickSlot(slot: Slot) {
    void send(`Please book ${formatTime(slot.time)}.`);
  }

  function handlePickDate(date: string) {
    void send(date);
  }

  function handleEditBooking(text: string) {
    void send(text);
  }

  async function submitBookingDecision(decision: "confirm" | "cancel") {
    if (!sessionId || chatBusy) return;

    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    setMessages((previous) => [
      ...previous,
      {
        id: createId("user"),
        role: "user",
        text: decision === "confirm" ? "Confirm appointment" : "Cancel appointment",
      },
    ]);

    try {
      const response =
        decision === "confirm"
          ? await confirmChatBooking(sessionId, { signal: controller.signal })
          : await cancelChatBooking(sessionId, { signal: controller.signal });
      setSessionId(response.session_id);
      setMessages((previous) => [
        ...previous,
        {
          id: createId("assistant"),
          role: "assistant",
          text: response.response,
          intent: response.intent,
          chunks: response.chunks ?? undefined,
          data: response.data ?? undefined,
        },
      ]);
      void refreshThreads();
    } catch (error) {
      if (controller.signal.aborted) {
        setMessages((previous) => [
          ...previous,
          { id: createId("stopped"), role: "assistant", text: "Response stopped." },
        ]);
        void refreshThreads();
      } else {
        setMessages((previous) => [
          ...previous,
          { id: createId("error"), role: "assistant", text: errorMessage(error), error: true },
        ]);
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setBusy(false);
    }
  }

  function handleConfirmBooking() {
    void submitBookingDecision("confirm");
  }

  function handleCancelBooking() {
    void submitBookingDecision("cancel");
  }

  async function handleDelete(targetSessionId: string) {
    try {
      await deleteConversation(targetSessionId);
    } catch (error) {
      console.error("Could not delete conversation", error);
    }
    if (targetSessionId === sessionId) handleNew();
    void refreshThreads();
  }

  /** Prepend the previous page of turns for the active thread. */
  async function handleLoadOlder() {
    if (!sessionId || loadingOlder) return;
    const oldest = messages.find((message) => message.id.startsWith("turn-"));
    const oldestId = Number(oldest?.id.replace("turn-", ""));
    if (!Number.isFinite(oldestId) || oldestId <= 0) return;

    setLoadingOlder(true);
    try {
      const detail = await getConversation(sessionId, { limit: PAGE_SIZE, before: oldestId });
      const older = detail.messages.map(turnToMessage);
      if (older.length === 0) {
        setOlderCount(0);
        return;
      }
      const node = scrollRef.current;
      scrollAnchorRef.current = node ? node.scrollHeight - node.scrollTop : null;
      setMessages((previous) => {
        const welcome = previous[0]?.id === WELCOME_MESSAGE.id ? previous : [];
        return [...welcome, ...older, ...previous.slice(welcome.length)];
      });
      setOlderCount(detail.has_more ? detail.message_count - older.length : 0);
    } catch (error) {
      console.error("Could not load earlier messages", error);
    } finally {
      setLoadingOlder(false);
    }
  }

  return (
    <main id="chat-workspace" className="flex min-h-80 flex-1 flex-col bg-background lg:flex-row">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="drawer-backdrop lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Conversation List Sidebar */}
      <aside
        className={cn(
          "flex w-full shrink-0 flex-col border-b border-line/70 bg-surface/60 lg:w-64 lg:border-b-0 lg:border-r",
          sidebarOpen ? "drawer-right open lg:translate-x-0" : "lg:translate-x-0",
        )}
      >
        <ConversationList
          threads={threads}
          activeSessionId={sessionId}
          loading={threadsLoading && status === "authenticated"}
          busy={chatBusy}
          onSelect={handleSelect}
          onNew={handleNew}
          onDelete={handleDelete}
          onRename={handleRename}
        />

        {/* Mobile sidebar header with close button */}
        <div className="lg:hidden border-t border-line p-3">
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium transition hover:bg-surface-muted touch-target"
          >
            <IconChevronLeft className="h-4 w-4" />
            Close conversations
          </button>
        </div>
      </aside>

      {/* Main chat area */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="border-b border-line/70 bg-surface/70">
          <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <div>
              <h1 className="text-sm font-semibold tracking-tight">Nishant Care Assistant</h1>
              <p className="text-xs text-muted">Chat naturally to ask questions or book a visit.</p>
            </div>
            <div className="flex items-center gap-2">
              {/* Mobile sidebar toggle */}
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                aria-label="Open conversations"
                aria-expanded={sidebarOpen}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-muted transition hover:bg-surface-muted hover:text-foreground lg:hidden touch-target"
              >
                <IconMessageSquare className="h-5 w-5" />
              </button>
              {sessionId && (
                <Button variant="ghost" size="sm" onClick={handleNew} disabled={chatBusy}>
                  Clear
                </Button>
              )}
            </div>
          </div>
        </div>

        <div ref={scrollRef} className="scroll-thin min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-1 px-4 py-6 pb-36 sm:px-6">
            {olderCount > 0 && (
              <div className="mb-2 flex justify-center">
                <Button variant="secondary" size="sm" onClick={handleLoadOlder} loading={loadingOlder}>
                  Load {Math.min(olderCount, PAGE_SIZE)} earlier messages
                </Button>
              </div>
            )}
            {messages.map((message) => (
              <ChatBubble
                key={message.id}
                message={message}
                busy={chatBusy}
                onPickSlot={handlePickSlot}
                onConfirmBooking={handleConfirmBooking}
                onCancelBooking={handleCancelBooking}
                onEditBooking={handleEditBooking}
                onPickDate={handlePickDate}
              />
            ))}
            {busy && <TypingBubble />}
          </div>
        </div>

        <div className="sticky bottom-0 border-t border-line/70 bg-background/90 px-4 py-3 backdrop-blur sm:px-6">
          <div className="mx-auto w-full max-w-3xl">
            <Composer onSend={(text) => void send(text)} onStop={handleStop} busy={chatBusy} />
            {status !== "authenticated" ? (
              <p className="mt-2 text-center text-2xs text-muted">
                Browsing as a guest — press{" "}
                <span className="font-medium text-foreground">Send</span> to sign in and start
                chatting.
              </p>
            ) : (
              <p className="mt-2 text-center text-2xs text-muted">
                Nishant Care Assistant can make mistakes. Confirm urgent medical details with the
                clinic.
              </p>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
