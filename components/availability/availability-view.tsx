"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  Alert,
  Avatar,
  Badge,
  Button,
  buttonClass,
  Card,
  EmptyState,
  Field,
  FilterChips,
  inputClass,
  PageHeader,
  Skeleton,
  SlotChip,
  SlotGrid,
  TextInput,
} from "@/components/ui";
import { IconClock, IconSearch, IconStethoscope } from "@/components/icons";
import { checkAvailability, getSchedule } from "@/lib/api";
import { useDoctors } from "@/lib/hooks";
import type { AvailabilityResponse, DoctorSchedule, Slot } from "@/lib/types";
import {
  cn,
  errorMessage,
  formatDate,
  formatTime,
  reasonLabel,
  toApiTime,
  todayIso,
} from "@/lib/utils";

/** How many day chips the date strip offers before the native picker takes over. */
const DAY_STRIP = 10;

/** Status filter applied to the slot grid (client side, on top of the API result). */
type StatusFilter = "all" | "free" | "booked";

/** One cached answer, tagged with the query key it belongs to. */
interface QueryResult {
  key: string;
  result: AvailabilityResponse | null;
  schedule: DoctorSchedule | null;
  error: string | null;
}

const PERIODS = [
  { key: "morning", label: "Morning", hint: "before 12 PM" },
  { key: "afternoon", label: "Afternoon", hint: "12 PM – 5 PM" },
  { key: "evening", label: "Evening", hint: "5 PM onwards" },
] as const;

type PeriodKey = (typeof PERIODS)[number]["key"];

/** `YYYY-MM-DD` for a local `Date` (mirrors `todayIso()` in lib/utils). */
function isoOf(day: Date): string {
  const local = new Date(day.getTime() - day.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function upcomingIsoDates(count: number): string[] {
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  return Array.from({ length: count }, (_, index) => {
    const day = new Date(base);
    day.setDate(base.getDate() + index);
    return isoOf(day);
  });
}

function weekdayShort(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { weekday: "short" });
}

function dayNumber(iso: string): string {
  return String(new Date(`${iso}T00:00:00`).getDate());
}

/** Bucket a `HH:MM:SS` slot into morning / afternoon / evening. */
function periodOf(time: string): PeriodKey {
  const hour = Number(time.slice(0, 2));
  if (Number.isNaN(hour) || hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

function chipClass(selected: boolean): string {
  return cn(
    "shrink-0 rounded-lg border px-3 py-1.5 text-center transition touch-target",
    selected
      ? "border-brand-400 bg-brand-50 text-brand-700 ring-1 ring-brand-400 dark:border-brand-600 dark:bg-brand-800/30 dark:text-brand-200 dark:ring-brand-600"
      : "border-line bg-surface text-muted hover:border-brand-300 hover:text-foreground",
  );
}

export function AvailabilityView() {
  const { doctors, loading: doctorsLoading, error: doctorsError, reload } = useDoctors();

  const [doctorChoice, setDoctorChoice] = useState("");
  const [date, setDate] = useState(todayIso());
  const [time, setTime] = useState("");
  const [search, setSearch] = useState("");
  const [response, setResponse] = useState<QueryResult | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selection, setSelection] = useState<{ key: string; time: string } | null>(null);

  /* Until the user picks someone, the first doctor on staff is used — the page
     shows real slots the moment it loads. */
  const doctorId = doctorChoice || (doctors.length > 0 ? String(doctors[0].id) : "");
  const hasQuery = Boolean(doctorId && date);
  /* One key describes the whole query: "busy" is simply "no answer for it yet". */
  const requestKey = `${doctorId}|${date}|${time}|${refreshToken}`;

  /* Re-query whenever the doctor, date, time or refresh token changes — the
     form is reactive, so no click is needed to browse days and doctors. */
  useEffect(() => {
    if (!hasQuery) return;
    const key = requestKey;
    let active = true;
    const timer = window.setTimeout(() => {
      Promise.all([
        checkAvailability({ doctor_id: Number(doctorId), date, time: toApiTime(time) }),
        getSchedule(Number(doctorId)).catch(() => null),
      ])
        .then(([availability, doctorSchedule]) => {
          if (!active) return;
          setResponse({ key, result: availability, schedule: doctorSchedule, error: null });
        })
        .catch((cause) => {
          if (!active) return;
          setResponse({ key, result: null, schedule: null, error: errorMessage(cause) });
        });
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [hasQuery, requestKey, doctorId, date, time]);

  const busy = hasQuery && response?.key !== requestKey;
  const result = hasQuery ? (response?.result ?? null) : null;
  const schedule = hasQuery ? (response?.schedule ?? null) : null;
  const error = hasQuery && response?.key === requestKey ? response.error : null;

  const dayStrip = useMemo(() => upcomingIsoDates(DAY_STRIP), []);
  const today = todayIso();

  const filteredDoctors = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return doctors;
    return doctors.filter((doctor) =>
      `${doctor.doctor_name} ${doctor.specialization ?? ""}`.toLowerCase().includes(needle),
    );
  }, [doctors, search]);

  const slots: Slot[] = result?.slots ?? [];
  /* The pick is keyed to the query, so a new doctor or date invalidates it
     without an effect having to clear it. */
  const selectedSlot =
    selection &&
    selection.key === requestKey &&
    slots.some((slot) => slot.time === selection.time && slot.available)
      ? selection.time
      : null;

  const toggleSlot = (slotTime: string) =>
    setSelection((current) =>
      current && current.key === requestKey && current.time === slotTime
        ? null
        : { key: requestKey, time: slotTime },
    );
  const freeCount = slots.filter((slot) => slot.available).length;
  const bookedCount = slots.length - freeCount;
  const freePercent = slots.length === 0 ? 0 : Math.round((freeCount / slots.length) * 100);

  const visibleSlots = slots.filter((slot) => {
    if (statusFilter === "free") return slot.available;
    if (statusFilter === "booked") return !slot.available;
    return true;
  });

  const grouped = PERIODS.map((period) => ({
    ...period,
    slots: visibleSlots.filter((slot) => periodOf(slot.time) === period.key),
  })).filter((section) => section.slots.length > 0);

  const selectedDoctor = doctors.find((doctor) => String(doctor.id) === doctorId) ?? null;
  const doctorName = schedule?.doctor_name ?? selectedDoctor?.doctor_name ?? "";
  const bookingPrompt =
    selectedSlot && doctorName && result
      ? `Book an appointment with ${doctorName} on ${result.date} at ${formatTime(selectedSlot)}`
      : "";

  const statusChips = [
    { value: "all", label: "All", count: slots.length },
    { value: "free", label: "Free", count: freeCount },
    { value: "booked", label: "Booked", count: bookedCount },
  ];

  return (
    <main className="page-shell">
      <PageHeader
        title="Availability"
        description="See when each doctor is free, slot by slot."
      />

      <div className="mt-5 grid items-start gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
        <Card title="Find a time" subtitle="Pick a doctor and a date — results update live.">
          <div className="space-y-4">
            {/* Doctor picker: a searchable list instead of a bare <select>. */}
            <div className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs font-medium text-muted">Doctor</span>
                {!doctorsLoading && !doctorsError && doctors.length > 0 && (
                  <span className="text-2xs text-muted">{doctors.length} on staff</span>
                )}
              </div>

              <div className="relative">
                <IconSearch
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search name or specialty…"
                  aria-label="Search doctors"
                  className={cn(inputClass, "pl-9")}
                />
              </div>

              <div
                role="group"
                aria-label="Doctors"
                className="scroll-thin max-h-60 divide-y divide-line overflow-y-auto rounded-lg border border-line bg-surface"
              >
                {doctorsLoading &&
                  Array.from({ length: 3 }, (_, index) => (
                    <div key={index} className="flex items-center gap-3 px-3 py-2.5">
                      <Skeleton className="h-8 w-8 rounded-full" />
                      <span className="flex-1 space-y-1.5">
                        <Skeleton className="h-3 w-2/3" />
                        <Skeleton className="h-2.5 w-1/2" />
                      </span>
                    </div>
                  ))}

                {!doctorsLoading &&
                  filteredDoctors.map((doctor) => {
                    const selected = String(doctor.id) === doctorId;
                    return (
                      <button
                        key={doctor.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setDoctorChoice(String(doctor.id))}
                        className={cn(
                          "flex w-full items-center gap-3 px-3 py-2.5 text-left transition",
                          selected ? "bg-brand-50 dark:bg-brand-800/25" : "hover:bg-surface-muted",
                        )}
                      >
                        <Avatar
                          name={doctor.doctor_name}
                          imageUrl={doctor.photo_url}
                          className="h-8 w-8 text-[10px]"
                        />
                        <span className="min-w-0 flex-1">
                          <span
                            className={cn(
                              "block truncate text-sm",
                              selected
                                ? "font-semibold text-brand-700 dark:text-brand-200"
                                : "font-medium text-foreground",
                            )}
                          >
                            {doctor.doctor_name}
                          </span>
                          <span className="block truncate text-2xs text-muted">
                            {doctor.specialization || "General"} · {formatTime(doctor.start_time)}
                            –{formatTime(doctor.end_time)}
                          </span>
                        </span>
                        {selected && (
                          <Badge tone="brand" className="shrink-0">
                            Selected
                          </Badge>
                        )}
                      </button>
                    );
                  })}

                {!doctorsLoading && !doctorsError && filteredDoctors.length === 0 && (
                  <p className="px-3 py-4 text-center text-xs text-muted">
                    No doctor matches “{search}”.
                  </p>
                )}
              </div>
            </div>

            {/* Date: quick chips for the next days plus the native picker. */}
            <div className="space-y-1.5">
              <span className="block text-xs font-medium text-muted">Date</span>
              <div
                role="group"
                aria-label="Quick dates"
                className="scroll-thin flex gap-1.5 overflow-x-auto pb-1"
              >
                {dayStrip.map((iso, index) => {
                  const selected = iso === date;
                  return (
                    <button
                      key={iso}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setDate(iso)}
                      className={chipClass(selected)}
                    >
                      <span className="block text-2xs font-medium uppercase tracking-wide">
                        {index === 0 ? "Today" : index === 1 ? "Tomorrow" : weekdayShort(iso)}
                      </span>
                      <span className="block text-sm font-semibold leading-tight">
                        {dayNumber(iso)}
                      </span>
                    </button>
                  );
                })}
              </div>
              <TextInput
                id="availability-date"
                type="date"
                value={date}
                min={today}
                onChange={(event) => setDate(event.target.value)}
                aria-label="Appointment date"
              />
            </div>

            <Field label="Time" hint="optional — check a single slot" htmlFor="availability-time">
              <TextInput
                id="availability-time"
                type="time"
                value={time}
                onChange={(event) => setTime(event.target.value)}
              />
            </Field>

            <Button
              className="w-full"
              onClick={() => setRefreshToken((value) => value + 1)}
              loading={busy}
              disabled={!doctorId || !date}
            >
              Check availability
            </Button>

            {doctorsError && (
              <Alert tone="danger">
                {doctorsError}
                <button
                  type="button"
                  onClick={() => void reload()}
                  className="ml-1 font-medium underline underline-offset-2"
                >
                  Retry
                </button>
              </Alert>
            )}

            {!doctorsLoading && !doctorsError && doctors.length === 0 && (
              <Alert tone="info">No doctors yet — add one on the Doctors page.</Alert>
            )}
          </div>
        </Card>

        <div className="space-y-5">
          {error && <Alert tone="danger">{error}</Alert>}

          {!doctorId && !doctorsLoading && (
            <EmptyState
              icon={<IconStethoscope className="h-5 w-5" />}
              title="Choose a doctor to see open slots"
              description="Pick a doctor and a date on the left and every free slot shows up here, ready to book."
            />
          )}

          {busy && !result && (
            <Card title="Loading slots…" subtitle="Asking the clinic calendar for free times.">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {Array.from({ length: 10 }, (_, index) => (
                  <Skeleton key={index} className="h-12" />
                ))}
              </div>
            </Card>
          )}

          {result && (
            <div
              className={cn(
                "space-y-5 transition-opacity",
                busy && "pointer-events-none opacity-60",
              )}
            >
              {/* Doctor + day summary */}
              <Card
                title={
                  <span className="flex min-w-0 items-center gap-2.5">
                    <Avatar
                      name={doctorName || "Doctor"}
                      imageUrl={selectedDoctor?.photo_url ?? null}
                      className="h-8 w-8 text-[10px]"
                    />
                    <span className="truncate">{doctorName || `Doctor #${result.doctor_id}`}</span>
                  </span>
                }
                subtitle={
                  schedule
                    ? `${schedule.specialization || "General practice"} · ${formatDate(result.date)}`
                    : formatDate(result.date)
                }
                action={
                  <Badge tone={result.available ? "success" : "danger"} dot>
                    {result.available ? "Slots open" : "Fully booked"}
                  </Badge>
                }
              >
                <dl className="grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <dt className="text-muted">Working hours</dt>
                    <dd className="mt-0.5 font-medium">
                      {schedule
                        ? `${formatTime(schedule.start_time)}–${formatTime(schedule.end_time)}`
                        : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted">Lunch break</dt>
                    <dd className="mt-0.5 font-medium">
                      {schedule?.break_start && schedule?.break_end
                        ? `${formatTime(schedule.break_start)}–${formatTime(schedule.break_end)}`
                        : "none"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted">Time off</dt>
                    <dd className="mt-0.5 font-medium">
                      {schedule?.leave_date ? formatDate(schedule.leave_date) : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted">Slot length</dt>
                    <dd className="mt-0.5 font-medium">
                      {schedule ? `${schedule.slot_duration} min` : "—"}
                    </dd>
                  </div>
                </dl>

                <div className="mt-4">
                  <div className="flex items-baseline justify-between text-2xs text-muted">
                    <span>Free slots</span>
                    <span className="font-medium text-foreground">
                      {freeCount} of {slots.length} free · {freePercent}%
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-muted">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-500",
                        freeCount > 0 ? "bg-brand-500" : "bg-muted/60",
                      )}
                      style={{ width: `${freePercent}%` }}
                    />
                  </div>
                </div>

                {result.reason && (
                  <Alert tone="warning" className="mt-3">
                    Requested time is unavailable: {reasonLabel(result.reason)}
                  </Alert>
                )}
              </Card>

              {/* Slot grid */}
              <Card
                title="Slots"
                subtitle={
                  slots.length === 0
                    ? "No schedule for this day."
                    : `Showing ${visibleSlots.length} of ${slots.length} · green tiles are open.`
                }
                action={
                  slots.length > 0 ? (
                    <FilterChips
                      options={statusChips}
                      value={statusFilter}
                      onChange={(value) => setStatusFilter(value as StatusFilter)}
                      label="Filter slots"
                    />
                  ) : undefined
                }
              >
                {slots.length === 0 ? (
                  <EmptyState
                    icon={<IconClock className="h-5 w-5" />}
                    title="This doctor has no schedule yet"
                    description="Add their working hours on the Doctors page, then check again."
                  />
                ) : grouped.length === 0 ? (
                  <EmptyState
                    title="No slots match this filter"
                    description="Switch the filter above to see the rest of the day."
                    action={
                      <Button variant="secondary" size="sm" onClick={() => setStatusFilter("all")}>
                        Show all slots
                      </Button>
                    }
                  />
                ) : (
                  <div className="space-y-4">
                    {grouped.map((section) => (
                      <section key={section.key}>
                        <div className="mb-2 flex items-center gap-2">
                          <IconClock className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
                          <h3 className="text-xs font-semibold">{section.label}</h3>
                          <span className="text-2xs text-muted">
                            {section.hint} · {section.slots.length} slots
                          </span>
                        </div>
                        <SlotGrid>
                          {section.slots.map((slot) => {
                            const selected = slot.time === selectedSlot;
                            return (
                              <li key={slot.time}>
                                <SlotChip
                                  time={formatTime(slot.time)}
                                  note={
                                    slot.available
                                      ? selected
                                        ? "selected"
                                        : "open"
                                      : reasonLabel(slot.reason)
                                  }
                                  state={
                                    selected ? "selected" : slot.available ? "open" : "unavailable"
                                  }
                                  disabled={!slot.available}
                                  onClick={
                                    slot.available ? () => toggleSlot(slot.time) : undefined
                                  }
                                  title={
                                    slot.available
                                      ? `Select ${formatTime(slot.time)}`
                                      : reasonLabel(slot.reason)
                                  }
                                />
                              </li>
                            );
                          })}
                        </SlotGrid>
                      </section>
                    ))}
                  </div>
                )}
              </Card>

              {/* Sticky action bar for the chosen slot */}
              {selectedSlot && bookingPrompt && (
                <div className="sticky bottom-4 z-10">
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-200 bg-surface px-4 py-3 shadow-lg dark:border-brand-800">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {formatTime(selectedSlot)} · {formatDate(result.date)}
                      </p>
                      <p className="truncate text-xs text-muted">
                        {doctorName} — hold this slot by booking in chat
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setSelection(null)}>
                        Clear
                      </Button>
                      <Link
                        href={{ pathname: "/", query: { prompt: bookingPrompt } }}
                        className={buttonClass("primary", "sm")}
                      >
                        Book this slot
                      </Link>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}