"use client";

import { useState } from "react";

import { IconPencil, IconPlus, IconTrash } from "@/components/icons";
import { Button } from "@/components/ui";
import type { ConversationSummary } from "@/lib/types";
import { cn } from "@/lib/utils";

/** `2026-10-01T09:12:00Z` -> `Today`, `Yesterday`, or `Oct 1`. */
function relativeDay(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  const startOf = (date: Date) =>
    new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const days = Math.round((startOf(new Date()) - startOf(parsed)) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return parsed.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export interface ConversationListProps {
  threads: ConversationSummary[];
  activeSessionId: string | null;
  loading: boolean;
  busy: boolean;
  onSelect: (sessionId: string) => void;
  onNew: () => void;
  onDelete: (sessionId: string) => void;
  onRename: (sessionId: string, title: string) => void;
}

/**
 * Sidebar of past chat threads.
 *
 * The list is the patient's memory across devices and browser profiles: the
 * backend keeps every turn, so a thread survives clearing local storage or
 * signing in somewhere else.
 */
export function ConversationList({
  threads,
  activeSessionId,
  loading,
  busy,
  onSelect,
  onNew,
  onDelete,
  onRename,
}: ConversationListProps) {
  /** Thread currently being retitled inline (ChatGPT-style pencil → input). */
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  function startRename(thread: ConversationSummary) {
    setEditingId(thread.session_id);
    setDraft(thread.title ?? "");
  }

  function commitRename() {
    if (!editingId) return;
    const target = editingId;
    const title = draft.trim();
    setEditingId(null);
    if (title) onRename(target, title);
  }

  return (
    <aside className="flex w-full shrink-0 flex-col border-b border-line/70 bg-surface/60 lg:w-64 lg:border-b-0 lg:border-r">
      <div className="px-3 py-3">
        <Button size="sm" className="w-full" onClick={onNew} disabled={busy}>
          <IconPlus className="h-4 w-4" />
          New chat
        </Button>
      </div>

      <div className="scroll-thin max-h-56 flex-1 overflow-y-auto px-2 pb-3 lg:max-h-none">
        {loading && threads.length === 0 ? (
          <p className="px-2 py-3 text-xs text-muted">Loading conversations…</p>
        ) : threads.length === 0 ? (
          <p className="px-2 py-3 text-xs text-muted">
            Your past chats will appear here.
          </p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {threads.map((thread) => {
              const active = thread.session_id === activeSessionId;
              return (
                <li key={thread.session_id} className="group relative">
                  {editingId === thread.session_id ? (
                    <input
                      autoFocus
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          commitRename();
                        }
                        if (event.key === "Escape") {
                          event.preventDefault();
                          setEditingId(null);
                        }
                      }}
                      // Leaving the field saves, like ChatGPT's rename box.
                      onBlur={commitRename}
                      maxLength={120}
                      aria-label="Conversation title"
                      className="w-full rounded-lg border border-accent-500 bg-surface px-2.5 py-2 text-xs font-medium text-foreground outline-none ring-2 ring-accent-100 dark:ring-accent-600/20"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => onSelect(thread.session_id)}
                      aria-current={active ? "true" : undefined}
                      className={cn(
                        "w-full rounded-lg px-2.5 py-2 pr-14 text-left transition",
                        active
                          ? "bg-surface-muted text-foreground"
                          : "text-muted hover:bg-surface-muted/60 hover:text-foreground",
                      )}
                    >
                      <span className="block truncate text-xs font-medium">
                        {thread.title || "New conversation"}
                      </span>
                      <span className="mt-0.5 block text-2xs opacity-70">
                        {relativeDay(thread.updated_at)}
                        {thread.message_count > 0 && ` · ${thread.message_count} messages`}
                      </span>
                    </button>
                  )}
                  {editingId !== thread.session_id && (
                    <div className="absolute right-1.5 top-1.5 flex items-center gap-0.5">
                      <button
                        type="button"
                        title="Rename conversation"
                        aria-label={`Rename ${thread.title || "conversation"}`}
                        onClick={() => startRename(thread)}
                        className="flex h-7 w-7 items-center justify-center rounded-md text-muted opacity-0 transition hover:bg-surface-muted hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
                      >
                        <IconPencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        title="Delete conversation"
                        aria-label={`Delete ${thread.title || "conversation"}`}
                        onClick={() => onDelete(thread.session_id)}
                        className="flex h-7 w-7 items-center justify-center rounded-md text-muted opacity-0 transition hover:bg-surface-muted hover:text-red-600 focus-visible:opacity-100 group-hover:opacity-100"
                      >
                        <IconTrash className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}
