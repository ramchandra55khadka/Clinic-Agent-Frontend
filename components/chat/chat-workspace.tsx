"use client";

import { useEffect, useRef, useState } from "react";

import { Composer } from "@/components/chat/composer";
import { ChatBubble, TypingBubble } from "@/components/chat/message";
import { Button } from "@/components/ui";
import { chat } from "@/lib/api";
import type { ChatMessage, ChatRequest, Slot } from "@/lib/types";
import { createId, errorMessage, formatTime } from "@/lib/utils";

const STORAGE_KEY = "nishant-care-chat";

const WELCOME_MESSAGE: ChatMessage = {
  id: "welcome",
  role: "assistant",
  intent: "fallback",
  text: `Namaste, welcome to Nishant Care.

I can help you learn about our doctors, check availability, and book an appointment here in chat. Tell me what you need, for example: “Book an appointment with doctor id 1 tomorrow at 10 AM.”`,
};

interface StoredState {
  sessionId: string | null;
  messages: ChatMessage[];
}

export function ChatWorkspace() {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<StoredState>;
        if (Array.isArray(parsed.messages) && parsed.messages.length > 0) setMessages(parsed.messages);
        if (parsed.sessionId) setSessionId(parsed.sessionId);
      }
    } catch {
      // Ignore malformed local storage.
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ sessionId, messages }));
    } catch {
      // Storage may be unavailable in private browsing.
    }
  }, [hydrated, sessionId, messages]);

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

  function handleReset() {
    setMessages([WELCOME_MESSAGE]);
    setSessionId(null);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore storage failures.
    }
  }

  return (
    <main className="flex min-h-[calc(100vh-112px)] flex-1 flex-col bg-background">
      <div className="border-b border-line/70 bg-surface/70">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div>
            <h1 className="text-sm font-semibold tracking-tight">Nishant Care Assistant</h1>
            <p className="text-xs text-muted">Chat naturally to ask questions or book a visit.</p>
          </div>
          <Button variant="ghost" size="sm" onClick={handleReset} disabled={busy}>
            Clear
          </Button>
        </div>
      </div>

      <div ref={scrollRef} className="scroll-thin flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-1 px-4 py-6 pb-36 sm:px-6">
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
    </main>
  );
}
