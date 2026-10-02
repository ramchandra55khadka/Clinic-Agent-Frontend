"use client";

import type { ChatMessage, Slot } from "@/lib/types";
import { cn, formatDate, formatTime, reasonLabel } from "@/lib/utils";
import { RichText } from "./rich-text";

/* ------------------------------------------------------------------ */
/* Slots                                                               */
/* ------------------------------------------------------------------ */

function SlotGrid({
  slots,
  onPick,
  busy,
}: {
  slots: Slot[];
  onPick: (slot: Slot) => void;
  busy: boolean;
}) {
  const availableCount = slots.filter((slot) => slot.available).length;

  return (
    <div className="mt-3 rounded-lg border border-line bg-surface-muted p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium">
          {availableCount} of {slots.length} slot{slots.length === 1 ? "" : "s"} available
        </p>
        <p className="text-[11px] text-muted">Click a slot to continue</p>
      </div>
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4">
        {slots.map((slot) => (
          <button
            key={slot.time}
            type="button"
            disabled={!slot.available || busy}
            onClick={() => onPick(slot)}
            title={slot.available ? "Available" : reasonLabel(slot.reason)}
            className={cn(
              "rounded-lg border px-2 py-1.5 text-xs font-medium transition",
              slot.available
                ? "border-emerald-300 bg-surface text-emerald-700 hover:border-emerald-500 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
                : "cursor-not-allowed border-line bg-surface/60 text-muted line-through opacity-70",
            )}
          >
            {formatTime(slot.time)}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Booking result                                                      */
/* ------------------------------------------------------------------ */

function BookingResult({ message }: { message: ChatMessage }) {
  const data = message.data;
  if (!data) return null;

  if (data.status === "success" && data.appointment) {
    const appointment = data.appointment;
    return (
      <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs dark:border-emerald-900 dark:bg-emerald-950/40">
        <p className="font-semibold text-emerald-800 dark:text-emerald-200">
          Appointment #{appointment.id} confirmed
        </p>
        <p className="mt-0.5 text-emerald-700 dark:text-emerald-300">
          {appointment.patient_name} · {formatDate(appointment.date)} at{" "}
          {formatTime(appointment.time)}
        </p>
        {appointment.email_status && (
          <p className="mt-1 text-emerald-700/90 dark:text-emerald-300/90">
            Confirmation email: {appointment.email_status}
          </p>
        )}
      </div>
    );
  }

  if (data.status === "failed") {
    return (
      <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
        Booking failed: {reasonLabel(data.reason) || "the slot is no longer available"}.
      </div>
    );
  }

  if (data.available === false && data.reason) {
    return (
      <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
        Not available: {reasonLabel(data.reason)}.
      </div>
    );
  }

  return null;
}

/* ------------------------------------------------------------------ */
/* Sources                                                             */
/* ------------------------------------------------------------------ */

function Sources({ chunks }: { chunks: NonNullable<ChatMessage["chunks"]> }) {
  const visible = chunks.filter((chunk) => chunk.source || chunk.content.trim());
  if (visible.length === 0) return null;

  return (
    <details className="mt-2 rounded-xl border border-line bg-surface-muted px-3 py-2">
      <summary className="cursor-pointer text-xs font-medium text-muted">
        Sources ({visible.length})
      </summary>
      <ul className="mt-2 space-y-2">
        {visible.map((chunk, index) => (
          <li
            key={`${chunk.source ?? "src"}-${chunk.chunk_id ?? index}`}
            className="rounded-lg border border-line bg-surface px-3 py-2"
          >
            <p className="text-[11px] font-medium text-muted">{chunk.source ?? "Clinic profile"}</p>
            <p className="mt-1 whitespace-pre-wrap text-xs text-muted">
              {chunk.content.length > 400 ? `${chunk.content.slice(0, 400)}…` : chunk.content}
            </p>
          </li>
        ))}
      </ul>
    </details>
  );
}

/* ------------------------------------------------------------------ */
/* Bubbles                                                             */
/* ------------------------------------------------------------------ */

export function ChatBubble({
  message,
  busy,
  onPickSlot,
}: {
  message: ChatMessage;
  busy: boolean;
  onPickSlot: (slot: Slot) => void;
}) {
  if (message.role === "user") {
    return (
      <div className="fade-in flex justify-end py-3">
        <div className="max-w-[82%] rounded-lg bg-surface-muted px-4 py-2.5 text-sm text-foreground shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <p className="whitespace-pre-wrap">{message.text}</p>
        </div>
      </div>
    );
  }

  const required = message.data?.required ?? [];

  return (
    <div className="fade-in flex gap-4 border-b border-line/50 py-6 last:border-b-0">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-600 text-sm font-semibold text-white">
        N
      </span>
      <div className="min-w-0 flex-1">
        <div
          className={cn(
            "prose-chat text-sm leading-7",
            message.error
              ? "rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
              : "text-foreground",
          )}
        >
          <RichText text={message.text} />

          {required.length > 0 && (
            <p className="mt-2 text-xs text-muted">
              Needed to continue: <span className="font-medium">{required.join(", ")}</span>
            </p>
          )}

          <BookingResult message={message} />

        </div>

        {message.data?.slots && message.data.slots.length > 0 && (
          <SlotGrid slots={message.data.slots} onPick={onPickSlot} busy={busy} />
        )}

        {message.chunks && message.chunks.length > 0 && <Sources chunks={message.chunks} />}
      </div>
    </div>
  );
}

export function TypingBubble() {
  return (
    <div className="flex gap-4 border-b border-line/50 py-6">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-600 text-sm font-semibold text-white">
        N
      </span>
      <div className="flex items-center gap-1 px-1 py-3">
        <span className="typing-dot h-2 w-2 rounded-full bg-accent-600" />
        <span className="typing-dot h-2 w-2 rounded-full bg-accent-600" />
        <span className="typing-dot h-2 w-2 rounded-full bg-accent-600" />
      </div>
    </div>
  );
}
