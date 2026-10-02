"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useAuth } from "@/components/auth/auth-provider";
import { Composer } from "@/components/chat/composer";
import { ConversationList } from "@/components/chat/conversation-list";
import { ChatBubble, TypingBubble } from "@/components/chat/message";
import { Button } from "@/components/ui";
import { chat, deleteConversation, getConversation, listConversations } from "@/lib/api";
import type {
  ChatMessage,
  ChatRequest,
  ConversationSummary,
  ConversationTurn,
  Slot,
} from "@/lib/types";
import { createId, errorMessage, formatTime } from "@/lib/utils";

const WELCOME_MESSAGE: ChatMessage = {
  id: "welcome",
  role: "assistant",
  intent: "fallback",
  text: `Namaste, welcome to Nishant Care.

I can help you learn about our doctors, check availability, and book an appointment here in chat. Tell me what you need, for example: “Book an appointment with doctor id 1 tomorrow at 10 AM.”`,
};

/** Turns kept per replay page; older ones are reachable via "load earlier". */
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
  const { user } = useAuth();
  const userId = user?.id ?? "anonymous";

  const [threads, setThreads] = useState<ConversationSummary[]>([]);
  const [threadsLoading, setThreadsLoading] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [olderCount, setOlderCount] = useState(0);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

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
      setThreadsLoading(true);
      try {
        const response = await listConversations();
        if (cancelled) return;
        const available = response.conversations ?? [];
        setThreads(available);

        let stored: string | null = null;
        try {
          const raw = window.localStorage.getItem(storageKey(userId));
          stored = raw ? ((JSON.parse(raw) as { sessionId?: string | null }).sessionId ?? null) : null;
        } catch {
          // Ignore malformed or unavailable storage.
        }

        // Only resume a thread the backend still knows about.
        const target = available.find((thread) => thread.session_id === stored);
        if (target) {
          setSessionId(target.session_id);
          await loadThread(target.session_id);
        }
      } catch (error) {
        console.error("Could not restore conversations", error);
      } finally {
        if (!cancelled) setThreadsLoading(false);
      }
    }

    void restore();
    return () => {
      cancelled = true;
    };
  }, [userId, user, loadThread]);

  useEffect(() => {
    if (!user) return;
    try {
      window.localStorage.setItem(storageKey(userId), JSON.stringify({ sessionId }));
    } catch {
      // Storage may be unavailable in private browsing.
    }
  }, [userId, user, sessionId]);

  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages, busy]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;

    setBusy(true);
    setMessages((previous) => [...previous, { id: createId("user"), role: "user", text: trimmed }]);

    const payload: ChatRequest = { session_id: sessionId, message: trimmed };

    try {
      const response = await chat(payload);
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
      setMessages((previous) => [
        ...previous,
        { id: createId("error"), role: "assistant", text: errorMessage(error), error: true },
      ]);
    } finally {
      setBusy(false);
    }
  }

  function handlePickSlot(slot: Slot) {
    void send(`Please book ${formatTime(slot.time)}.`);
  }

  /** Start a blank thread. The old one stays on the server and in the sidebar. */
  function handleNew() {
    setSessionId(null);
    setMessages([WELCOME_MESSAGE]);
    setOlderCount(0);
    try {
      window.localStorage.setItem(storageKey(userId), JSON.stringify({ sessionId: null }));
    } catch {
      // Ignore storage failures.
    }
  }

  function handleSelect(targetSessionId: string) {
    if (busy || targetSessionId === sessionId) return;
    setSessionId(targetSessionId);
    void loadThread(targetSessionId);
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
    <main className="flex min-h-[calc(100vh-112px)] flex-1 flex-col bg-background lg:flex-row">
      <ConversationList
        threads={threads}
        activeSessionId={sessionId}
        loading={threadsLoading}
        busy={busy}
        onSelect={handleSelect}
        onNew={handleNew}
        onDelete={handleDelete}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="border-b border-line/70 bg-surface/70">
          <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <div>
              <h1 className="text-sm font-semibold tracking-tight">Nishant Care Assistant</h1>
              <p className="text-xs text-muted">Chat naturally to ask questions or book a visit.</p>
            </div>
            {sessionId && (
              <Button variant="ghost" size="sm" onClick={handleNew} disabled={busy}>
                Clear
              </Button>
            )}
          </div>
        </div>

        <div ref={scrollRef} className="scroll-thin flex-1 overflow-y-auto">
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-1 px-4 py-6 pb-36 sm:px-6">
            {olderCount > 0 && (
              <div className="mb-2 flex justify-center">
                <Button variant="secondary" size="sm" onClick={handleLoadOlder} loading={loadingOlder}>
                  Load {Math.min(olderCount, PAGE_SIZE)} earlier messages
                </Button>
              </div>
            )}
            {messages.map((message) => (
              <ChatBubble key={message.id} message={message} busy={busy} onPickSlot={handlePickSlot} />
            ))}
            {busy && <TypingBubble />}
          </div>
        </div>

        <div className="sticky bottom-0 border-t border-line/70 bg-background/90 px-4 py-3 backdrop-blur sm:px-6">
          <div className="mx-auto w-full max-w-3xl">
            <Composer onSend={(text) => void send(text)} busy={busy} />
            <p className="mt-2 text-center text-[11px] text-muted">
              Nishant Care Assistant can make mistakes. Confirm urgent medical details with the clinic.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
