"use client";

import { useState } from "react";

import type { ChatDoctor, ChatMessage, PendingBooking, Slot } from "@/lib/types";
import { cn, formatDate, formatTime, fromApiTime, reasonLabel, todayIso } from "@/lib/utils";
import { IconCalendarCheck } from "@/components/icons";
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
        <p className="text-2xs text-muted">Click a slot to continue</p>
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
/* Doctor profiles                                                     */
/* ------------------------------------------------------------------ */

function compactDays(days?: string[]): string {
  if (!days || days.length === 0) return "Days not set";
  if (days.length === 7) return "Every day";
  return days.join(", ");
}

function DoctorProfiles({ doctors, view }: { doctors: ChatDoctor[]; view: "list" | "detail" }) {
  if (doctors.length === 0) return null;

  if (view === "list") {
    return (
      <section className="mt-3 rounded-lg border border-line bg-surface-muted p-3">
        <p className="text-xs font-semibold text-foreground">Doctors at Nishant Care</p>
        <div className="mt-2 grid grid-cols-1 gap-2">
          {doctors.map((doctor) => {
            const schedule = doctor.schedules?.[0];
            const details = [
              doctor.specialization,
              doctor.experience_years !== null && doctor.experience_years !== undefined
                ? `${doctor.experience_years} years experience`
                : null,
              doctor.consultation_fee !== null && doctor.consultation_fee !== undefined
                ? `Fee ${doctor.consultation_fee}`
                : null,
            ].filter(Boolean);

            return (
              <div key={doctor.id} className="rounded-lg border border-line bg-surface px-3 py-2">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{doctor.doctor_name}</p>
                    {details.length > 0 && <p className="mt-0.5 text-xs text-muted">{details.join(" · ")}</p>}
                  </div>
                  {doctor.is_verified && (
                    <span className="w-fit rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-2xs font-medium text-emerald-700">
                      Verified
                    </span>
                  )}
                </div>
                {schedule && (
                  <p className="mt-1 text-xs text-muted">
                    {compactDays(schedule.days)} · {formatTime(schedule.start_time)}-{formatTime(schedule.end_time)}
                  </p>
                )}
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-2xs text-muted">Ask about a doctor by name for full details.</p>
      </section>
    );
  }

  return (
    <div className="mt-3 space-y-3">
      {doctors.map((doctor) => {
        const schedule = doctor.schedules?.[0];
        const education = doctor.educations ?? [];
        return (
          <section
            key={doctor.id}
            className="rounded-lg border border-line bg-surface-muted p-3 shadow-xs"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">{doctor.doctor_name}</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {doctor.specialization && (
                    <span className="rounded-full border border-accent-500/40 bg-accent-50 px-2 py-0.5 text-2xs font-medium text-accent-700">
                      {doctor.specialization}
                    </span>
                  )}
                  {doctor.is_verified && (
                    <span className="rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-2xs font-medium text-emerald-700">
                      Verified
                    </span>
                  )}
                </div>
              </div>
              {(doctor.consultation_fee !== null && doctor.consultation_fee !== undefined) && (
                <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs sm:text-right">
                  <p className="text-2xs text-muted">Fee</p>
                  <p className="font-semibold text-foreground">{doctor.consultation_fee}</p>
                </div>
              )}
            </div>

            <dl className="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
              {doctor.qualification && (
                <div>
                  <dt className="text-2xs font-medium text-muted">Qualification</dt>
                  <dd className="mt-0.5 font-medium text-foreground">{doctor.qualification}</dd>
                </div>
              )}
              {doctor.experience_years !== null && doctor.experience_years !== undefined && (
                <div>
                  <dt className="text-2xs font-medium text-muted">Experience</dt>
                  <dd className="mt-0.5 font-medium text-foreground">{doctor.experience_years} years</dd>
                </div>
              )}
              {doctor.consultation_duration !== null && doctor.consultation_duration !== undefined && (
                <div>
                  <dt className="text-2xs font-medium text-muted">Visit duration</dt>
                  <dd className="mt-0.5 font-medium text-foreground">{doctor.consultation_duration} minutes</dd>
                </div>
              )}
              {schedule && (
                <div>
                  <dt className="text-2xs font-medium text-muted">Schedule</dt>
                  <dd className="mt-0.5 font-medium text-foreground">
                    {compactDays(schedule.days)} · {formatTime(schedule.start_time)}-{formatTime(schedule.end_time)}
                  </dd>
                </div>
              )}
              {(doctor.phone || doctor.email) && (
                <div className="sm:col-span-2">
                  <dt className="text-2xs font-medium text-muted">Contact</dt>
                  <dd className="mt-0.5 break-words font-medium text-foreground">
                    {[doctor.phone, doctor.email].filter(Boolean).join(" · ")}
                  </dd>
                </div>
              )}
            </dl>

            {doctor.bio && <p className="mt-3 text-xs leading-5 text-muted">{doctor.bio}</p>}

            {education.length > 0 && (
              <div className="mt-3 border-t border-line pt-3">
                <p className="text-2xs font-semibold text-muted">Education</p>
                <ul className="mt-1 space-y-1 text-xs text-foreground">
                  {education.map((item) => (
                    <li key={item.id ?? `${item.degree}-${item.institution}`}>
                      <span className="font-medium">{item.degree}</span>
                      <span className="text-muted"> · {item.institution}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Date picker                                                         */
/* ------------------------------------------------------------------ */

function DatePickerPrompt({
  busy,
  onPickDate,
}: {
  busy: boolean;
  onPickDate: (date: string) => void;
}) {
  // One value drives both controls: the patient can type a date in any common
  // format, or pick one from the calendar (which fills the same value with the
  // ISO date). Typing over the text field keeps the two in sync automatically.
  const [value, setValue] = useState("");
  const trimmed = value.trim();
  const calendarValue = /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : "";

  function submit() {
    if (!trimmed || busy) return;
    onPickDate(trimmed);
  }

  return (
    <div className="mt-3 rounded-lg border border-line bg-surface-muted p-3">
      <div className="space-y-1.5 text-xs">
        <span className="block font-medium text-muted">Select appointment date</span>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            type="text"
            value={value}
            disabled={busy}
            placeholder="Type a date, e.g. 2026-10-03 or Nov 2"
            aria-label="Type the appointment date"
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                submit();
              }
            }}
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-foreground outline-none transition focus:border-accent-500 disabled:opacity-60 sm:max-w-64"
          />
          <span className="hidden text-2xs text-muted sm:inline">or pick</span>
          <input
            type="date"
            min={todayIso()}
            value={calendarValue}
            disabled={busy}
            aria-label="Pick the appointment date from the calendar"
            onChange={(event) => setValue(event.target.value)}
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-foreground outline-none transition focus:border-accent-500 disabled:opacity-60 sm:max-w-48"
          />
          <button
            type="button"
            disabled={!trimmed || busy}
            onClick={submit}
            className="inline-flex items-center justify-center rounded-lg bg-accent-600 px-3 py-2 text-xs font-medium text-white transition hover:bg-accent-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Use this date
          </button>
        </div>
        <p className="text-2xs text-muted">Type a date or choose one from the calendar.</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sex options                                                         */
/* ------------------------------------------------------------------ */

const SEX_OPTIONS = ["Male", "Female", "Other"] as const;

function SexPickerPrompt({
  busy,
  onPick,
}: {
  busy: boolean;
  onPick: (value: string) => void;
}) {
  return (
    <div className="mt-3 rounded-lg border border-line bg-surface-muted p-3">
      <p className="mb-2 text-xs font-medium text-muted">Select sex</p>
      <div className="flex flex-wrap gap-2">
        {SEX_OPTIONS.map((option) => (
          <button
            key={option}
            type="button"
            disabled={busy}
            onClick={() => onPick(option)}
            className="rounded-lg border border-line bg-surface px-4 py-1.5 text-xs font-medium text-foreground transition hover:border-accent-500 hover:bg-accent-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Clarifying follow-up chips                                          */
/* ------------------------------------------------------------------ */

function QuickReplies({
  options,
  busy,
  onPick,
}: {
  options: string[];
  busy: boolean;
  onPick: (value: string) => void;
}) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          disabled={busy}
          onClick={() => onPick(option)}
          className="rounded-full border border-accent-500/60 bg-accent-50 px-3 py-1.5 text-xs font-medium text-accent-600 transition hover:bg-accent-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {option}
        </button>
      ))}
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

function bookingEditText(booking: Required<Pick<PendingBooking, "patient_name" | "age" | "sex" | "email" | "phone" | "date" | "time">>) {
  return [
    `patient name is ${booking.patient_name}`,
    `age is ${booking.age}`,
    `sex ${booking.sex}`,
    `email ${booking.email}`,
    `phone ${booking.phone}`,
    `date ${booking.date}`,
    `time ${booking.time}`,
  ].join(". ");
}

function BookingSummary({
  message,
  busy,
  onEditBooking,
}: {
  message: ChatMessage;
  busy: boolean;
  onEditBooking: (text: string) => void;
}) {
  const booking = message.data?.booking;
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    patient_name: booking?.patient_name ?? "",
    age: booking?.age ? String(booking.age) : "",
    sex: booking?.sex ?? "",
    email: booking?.email ?? "",
    phone: booking?.phone ?? "",
    date: booking?.date ?? "",
    time: fromApiTime(booking?.time),
  });
  if (!booking) return null;

  const rows = [
    ["Patient", booking.patient_name],
    ["Age", booking.age],
    ["Sex", booking.sex],
    ["Email", booking.email],
    ["Phone", booking.phone],
    ["Doctor", booking.doctor_name ?? (booking.doctor_id ? `Doctor #${booking.doctor_id}` : undefined)],
    ["Date", booking.date ? formatDate(booking.date) : undefined],
    ["Time", booking.time ? formatTime(booking.time) : undefined],
  ].filter((row): row is [string, string | number] => row[1] !== undefined && row[1] !== null && row[1] !== "");

  if (rows.length === 0) return null;

  const canSave =
    form.patient_name.trim() &&
    form.age.trim() &&
    form.sex.trim() &&
    form.email.trim() &&
    form.phone.trim() &&
    form.date.trim() &&
    form.time.trim();

  function submitEdit() {
    if (!canSave || busy) return;
    onEditBooking(
      bookingEditText({
        patient_name: form.patient_name.trim(),
        age: form.age.trim(),
        sex: form.sex,
        email: form.email.trim(),
        phone: form.phone.trim(),
        date: form.date,
        time: form.time,
      }),
    );
    setEditing(false);
  }

  return (
    <div className="mt-3 rounded-lg border border-line bg-surface-muted p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold text-foreground">Review appointment details</p>
        <button
          type="button"
          disabled={busy}
          onClick={() => setEditing((value) => !value)}
          className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-2xs font-medium text-foreground transition hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50"
        >
          {editing ? "Close edit" : "Edit details"}
        </button>
      </div>

      {editing ? (
        <div className="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
          <label className="space-y-1">
            <span className="text-2xs font-medium text-muted">Patient name</span>
            <input
              value={form.patient_name}
              onChange={(event) => setForm((current) => ({ ...current, patient_name: event.target.value }))}
              className="w-full rounded-lg border border-line bg-surface px-2.5 py-2 text-xs outline-none focus:border-accent-500"
            />
          </label>
          <label className="space-y-1">
            <span className="text-2xs font-medium text-muted">Age</span>
            <input
              value={form.age}
              inputMode="numeric"
              onChange={(event) => setForm((current) => ({ ...current, age: event.target.value }))}
              className="w-full rounded-lg border border-line bg-surface px-2.5 py-2 text-xs outline-none focus:border-accent-500"
            />
          </label>
          <label className="space-y-1">
            <span className="text-2xs font-medium text-muted">Gender</span>
            <select
              value={form.sex}
              onChange={(event) => setForm((current) => ({ ...current, sex: event.target.value }))}
              className="w-full rounded-lg border border-line bg-surface px-2.5 py-2 text-xs outline-none focus:border-accent-500"
            >
              <option value="">Select</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-2xs font-medium text-muted">Email</span>
            <input
              value={form.email}
              type="email"
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              className="w-full rounded-lg border border-line bg-surface px-2.5 py-2 text-xs outline-none focus:border-accent-500"
            />
          </label>
          <label className="space-y-1">
            <span className="text-2xs font-medium text-muted">Phone</span>
            <input
              value={form.phone}
              onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
              className="w-full rounded-lg border border-line bg-surface px-2.5 py-2 text-xs outline-none focus:border-accent-500"
            />
          </label>
          <label className="space-y-1">
            <span className="text-2xs font-medium text-muted">Date</span>
            <input
              value={form.date}
              type="date"
              onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))}
              className="w-full rounded-lg border border-line bg-surface px-2.5 py-2 text-xs outline-none focus:border-accent-500"
            />
          </label>
          <label className="space-y-1">
            <span className="text-2xs font-medium text-muted">Time</span>
            <input
              value={form.time}
              type="time"
              onChange={(event) => setForm((current) => ({ ...current, time: event.target.value }))}
              className="w-full rounded-lg border border-line bg-surface px-2.5 py-2 text-xs outline-none focus:border-accent-500"
            />
          </label>
          <div className="flex items-end gap-2">
            <button
              type="button"
              disabled={!canSave || busy}
              onClick={submitEdit}
              className="inline-flex items-center justify-center rounded-lg bg-accent-600 px-3 py-2 text-xs font-medium text-white transition hover:bg-accent-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Save changes
            </button>
          </div>
        </div>
      ) : (
        <dl className="mt-2 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
          {rows.map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="text-2xs font-medium text-muted">{label}</dt>
              <dd className="mt-0.5 break-words font-medium text-foreground">{value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
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
            <p className="text-2xs font-medium text-muted">{chunk.source ?? "Clinic profile"}</p>
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
  onConfirmBooking,
  onCancelBooking,
  onEditBooking,
  onPickDate,
}: {
  message: ChatMessage;
  busy: boolean;
  onPickSlot: (slot: Slot) => void;
  onConfirmBooking: () => void;
  onCancelBooking: () => void;
  onEditBooking: (text: string) => void;
  onPickDate: (date: string) => void;
}) {
  if (message.role === "user") {
    return (
      <div className="fade-in flex justify-end py-3">
        <div className="max-w-[82%] rounded-lg bg-surface-muted px-4 py-2.5 text-sm text-foreground shadow-xs">
          <p className="whitespace-pre-wrap">{message.text}</p>
        </div>
      </div>
    );
  }

  const required = message.data?.required ?? [];
  const needsDate = required.includes("date") || required.includes("appointment_date");
  const needsSex = required.includes("sex");
  const clarificationOptions = message.data?.clarification_options ?? [];
  const doctorProfiles =
    message.data?.source === "database" && message.intent === "doctor_bio" ? (message.data.doctors ?? []) : [];
  const doctorView = message.data?.view === "list" ? "list" : "detail";
  const showText = doctorProfiles.length === 0;
  const needsConfirmation =
    message.data?.awaiting_confirmation === true && required.includes("confirmation") && !message.data.appointment;

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
          {showText && <RichText text={message.text} />}

          {required.length > 0 && (
            <p className="mt-2 text-xs text-muted">
              Needed to continue: <span className="font-medium">{required.join(", ")}</span>
            </p>
          )}

          <BookingResult message={message} />

        </div>

        {doctorProfiles.length > 0 && <DoctorProfiles doctors={doctorProfiles} view={doctorView} />}

        {needsConfirmation && (
          <div className="mt-3">
            <BookingSummary message={message} busy={busy} onEditBooking={onEditBooking} />
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={onConfirmBooking}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <IconCalendarCheck className="h-4 w-4" />
                Confirm appointment
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={onCancelBooking}
                className="inline-flex items-center justify-center rounded-lg border border-line bg-surface px-3 py-2 text-xs font-medium text-foreground transition hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel appointment
              </button>
            </div>
          </div>
        )}

        {needsDate && <DatePickerPrompt busy={busy} onPickDate={onPickDate} />}

        {needsSex && <SexPickerPrompt busy={busy} onPick={onEditBooking} />}

        {clarificationOptions.length > 0 && (
          <QuickReplies options={clarificationOptions} busy={busy} onPick={onEditBooking} />
        )}

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
