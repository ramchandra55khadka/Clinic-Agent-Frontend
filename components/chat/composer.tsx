"use client";

import { useState } from "react";

const QUICK_PROMPTS = [
  "Book an appointment for me",
  "Book doctor id 1 tomorrow at 10 AM",
  "Tell me about our doctors",
];

export function Composer({
  onSend,
  busy,
}: {
  onSend: (text: string) => void;
  busy: boolean;
}) {
  const [value, setValue] = useState("");

  function submit() {
    const text = value.trim();
    if (!text || busy) return;
    onSend(text);
    setValue("");
  }

  return (
    <div>
      <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1">
        {QUICK_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            disabled={busy}
            onClick={() => onSend(prompt)}
            className="shrink-0 rounded-full border border-line bg-surface px-3 py-1.5 text-xs text-muted transition hover:bg-surface-muted hover:text-foreground disabled:opacity-50"
          >
            {prompt}
          </button>
        ))}
      </div>

      <div className="flex items-end gap-2 rounded-3xl border border-line bg-surface p-2 shadow-sm focus-within:border-accent-500 focus-within:ring-2 focus-within:ring-accent-100 dark:focus-within:ring-accent-600/20">
        <textarea
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
          rows={1}
          placeholder="Message Nishant Care"
          className="scroll-thin max-h-40 min-h-10 w-full resize-none bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted/70"
        />
        <button
          type="button"
          onClick={submit}
          disabled={busy || value.trim().length === 0}
          aria-label="Send message"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-600 text-white transition hover:bg-accent-600/90 disabled:cursor-not-allowed disabled:bg-muted/40"
        >
          ↑
        </button>
      </div>
    </div>
  );
}
