"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { IconCalendarCheck, IconChevronDown, IconClock, IconStethoscope } from "@/components/icons";
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  LoadingBlock,
  PageHeader,
  SelectInput,
  StatCard,
  TextInput,
} from "@/components/ui";
import {
  cancelMyAppointment,
  listMyAppointments,
  listSlots,
  updateMyAppointment,
} from "@/lib/api";
import { doctorLabel, useDoctors } from "@/lib/hooks";
import type { Appointment, AppointmentUpdate, Slot } from "@/lib/types";
import {
  cn,
  errorMessage,
  formatDate,
  formatTime,
  fromApiTime,
  reasonLabel,
  toApiTime,
  todayIso,
} from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const FILTERS = [
  { key: "upcoming", label: "Upcoming" },
  { key: "past", label: "Past" },
  { key: "cancelled", label: "Cancelled" },
  { key: "all", label: "All" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

const STATUS_LABELS: Record<string, string> = {
  confirmed: "Confirmed",
  cancelled: "Cancelled",
};

const EMAIL_LABELS: Record<string, string> = {
  sent: "A confirmation email has been sent.",
  pending: "Your confirmation email is on its way.",
  skipped: "A confirmation email was not sent — please keep your appointment details safe.",
  failed: "We could not send your confirmation email. Please contact the clinic.",
};

const SEX_OPTIONS = ["female", "male", "other"];

interface EditForm {
  patient_name: string;
  age: string;
  sex: string;
  phone: string;
  date: string;
  time: string;
}

function formFrom(appointment: Appointment): EditForm {
  return {
    patient_name: appointment.patient_name,
    age: String(appointment.age),
    sex: appointment.sex,
    phone: appointment.phone,
    date: appointment.date,
    time: fromApiTime(appointment.time),
  };
}

/** Chronological sort key: `2030-01-07 09:00`. */
function sortKey(appointment: Appointment): string {
  return `${appointment.date} ${fromApiTime(appointment.time)}`;
}

function statusTone(status: string): "success" | "danger" | "neutral" {
  if (status === "confirmed") return "success";
  if (status === "cancelled") return "danger";
  return "neutral";
}

/* ------------------------------------------------------------------ */
/* View                                                                */
/* ------------------------------------------------------------------ */

export function MyAppointmentsView() {
  const { doctors } = useDoctors();

  const [appointments, setAppointments] = useState<Appointment[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [filter, setFilter] = useState<FilterKey>("upcoming");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<EditForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const [slotState, setSlotState] = useState<{
    key: string;
    slots: Slot[];
    error: string | null;
  } | null>(null);

  const today = todayIso();

  /* Load the patient's own bookings; `reloadKey` drives manual refresh. */
  useEffect(() => {
    let active = true;

    listMyAppointments()
      .then((rows) => {
        if (!active) return;
        setAppointments(rows);
        setLoadError(null);
      })
      .catch((cause) => {
        if (!active) return;
        setAppointments([]);
        setLoadError(errorMessage(cause));
      });

    return () => {
      active = false;
    };
  }, [reloadKey]);

  const selected = appointments?.find((row) => row.id === selectedId) ?? null;
  const selectedRecordId = selected?.id ?? null;
  const selectedDoctorId = selected?.doctor_id ?? null;
  const editDate = form?.date ?? "";

  /* While editing, offer the doctor's open slots for the chosen date. The
     patient's own booking is excluded so it still reads as free. */
  useEffect(() => {
    if (!editing || selectedRecordId === null || selectedDoctorId === null || !editDate) return;
    const key = `${selectedRecordId}:${editDate}`;
    let active = true;

    listSlots(selectedDoctorId, editDate, selectedRecordId)
      .then((response) => {
        if (active) setSlotState({ key, slots: response.slots, error: null });
      })
      .catch((cause) => {
        if (active) setSlotState({ key, slots: [], error: errorMessage(cause) });
      });

    return () => {
      active = false;
    };
  }, [editing, selectedRecordId, selectedDoctorId, editDate]);

  const doctorNames = useMemo(() => {
    const map = new Map<number, string>();
    for (const doctor of doctors) map.set(doctor.id, doctorLabel(doctor));
    return map;
  }, [doctors]);

  const doctorName = (appointment: Appointment): string =>
    doctorNames.get(appointment.doctor_id) ?? `Doctor #${appointment.doctor_id}`;

  const sorted = useMemo(() => {
    const rows = [...(appointments ?? [])];
    rows.sort((left, right) => sortKey(left).localeCompare(sortKey(right)));
    return rows;
  }, [appointments]);

  const visible = useMemo(() => {
    const rows = sorted.filter((appointment) => {
      if (filter === "all") return true;
      if (filter === "cancelled") return appointment.status === "cancelled";
      if (filter === "past") return appointment.status !== "cancelled" && appointment.date < today;
      return appointment.status !== "cancelled" && appointment.date >= today;
    });
    return filter === "past" ? rows.reverse() : rows;
  }, [sorted, filter, today]);

  const upcomingCount = sorted.filter(
    (appointment) => appointment.status !== "cancelled" && appointment.date >= today,
  ).length;
  const nextVisit = sorted.find(
    (appointment) => appointment.status !== "cancelled" && appointment.date >= today,
  );
  const cancelledCount = sorted.filter((appointment) => appointment.status === "cancelled").length;

  const slotsBusy = editing && slotState?.key !== `${selectedRecordId}:${editDate}`;

  /* ---------------------------- actions ---------------------------- */

  function selectAppointment(appointment: Appointment) {
    setSelectedId((current) => (current === appointment.id ? null : appointment.id));
    setEditing(false);
    setForm(null);
    setFormError(null);
    setNotice(null);
    setConfirmingCancel(false);
  }

  function startEditing(appointment: Appointment) {
    setEditing(true);
    setForm(formFrom(appointment));
    setFormError(null);
    setNotice(null);
    setConfirmingCancel(false);
  }

  function stopEditing() {
    setEditing(false);
    setForm(null);
    setFormError(null);
    setSlotState(null);
  }

  function replaceAppointment(updated: Appointment) {
    setAppointments((rows) => (rows ?? []).map((row) => (row.id === updated.id ? updated : row)));
  }

  async function handleSave() {
    if (!selected || !form) return;

    const name = form.patient_name.trim();
    const phone = form.phone.trim();
    const age = Number(form.age);
    const time = toApiTime(form.time);

    if (name.length < 2) return setFormError("Please enter the patient's full name.");
    if (!form.age || !Number.isInteger(age) || age < 0 || age > 120) {
      return setFormError("Please enter an age between 0 and 120.");
    }
    if (phone.length < 7) return setFormError("Please enter a contact number.");
    if (!form.date) return setFormError("Please choose a date.");
    if (!time) return setFormError("Please choose a time slot.");

    const changes: AppointmentUpdate = {};
    if (name !== selected.patient_name) changes.patient_name = name;
    if (age !== selected.age) changes.age = age;
    if (form.sex !== selected.sex) changes.sex = form.sex;
    if (phone !== selected.phone) changes.phone = phone;
    if (form.date !== selected.date) changes.date = form.date;
    if (time !== selected.time) changes.time = time;

    if (Object.keys(changes).length === 0) {
      setFormError("Nothing has changed yet.");
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      const updated = await updateMyAppointment(selected.id, changes);
      replaceAppointment(updated);
      setEditing(false);
      setForm(null);
      setSlotState(null);
      setNotice(
        changes.date || changes.time
          ? `Appointment moved to ${formatDate(updated.date)} at ${formatTime(updated.time)}. A new confirmation is on its way.`
          : "Your appointment details were updated.",
      );
    } catch (cause) {
      setFormError(errorMessage(cause));
    } finally {
      setSaving(false);
    }
  }

  async function handleCancel(appointment: Appointment) {
    setCancelling(true);
    setFormError(null);
    try {
      const updated = await cancelMyAppointment(appointment.id);
      replaceAppointment(updated);
      setConfirmingCancel(false);
      setEditing(false);
      setForm(null);
      setNotice("Your appointment was cancelled and the slot is now free.");
    } catch (cause) {
      setFormError(errorMessage(cause));
    } finally {
      setCancelling(false);
    }
  }

  function refresh() {
    setAppointments(null);
    setLoadError(null);
    setNotice(null);
    setReloadKey((value) => value + 1);
  }

const filterCounts: Record<FilterKey, number> = {
    upcoming: upcomingCount,
    past: sorted.filter(
      (appointment) => appointment.status !== "cancelled" && appointment.date < today,
    ).length,
    cancelled: cancelledCount,
    all: sorted.length,
  };

  /* Until the first load resolves, metrics stay neutral instead of showing 0. */
  const metric = (value: number | string): ReactNode => (appointments === null ? "—" : value);

  return (
    <main className="page-shell">
      <PageHeader
        title="My appointments"
        description="Review your visits, update your details, or reschedule — no need to call the clinic."
        actions={
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={refresh}
              disabled={appointments === null}
            >
              Refresh
            </Button>
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
            >
              Book a new visit
            </Link>
          </>
        }
      />

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <StatCard label="Upcoming visits" value={metric(upcomingCount)} tone="brand" />
        <StatCard
          label="Next visit"
          value={
            appointments === null ? (
              <span className="text-base text-muted">—</span>
            ) : nextVisit ? (
              <span className="text-base">
                {formatDate(nextVisit.date)}
                <span className="text-muted"> · {formatTime(nextVisit.time)}</span>
              </span>
            ) : (
              <span className="text-base text-muted">None booked</span>
            )
          }
        />
        <StatCard
          label="Cancelled"
          value={metric(cancelledCount)}
          tone={cancelledCount > 0 ? "danger" : "neutral"}
        />
      </div>

      {loadError && (
        <Alert tone="danger" className="mt-5">
          {loadError}
          <button
            type="button"
            onClick={refresh}
            className="ml-1 font-medium underline underline-offset-2"
          >
            Try again
          </button>
        </Alert>
      )}

      {notice && (
        <Alert tone="success" className="mt-5">
          {notice}
        </Alert>
      )}

      {selected && (
        <Card
          className="mt-5"
          title={editing ? "Edit appointment" : formatDate(selected.date)}
          subtitle={doctorName(selected)}
          action={
            <Badge tone={statusTone(selected.status)}>
              {STATUS_LABELS[selected.status] ?? selected.status}
            </Badge>
          }
        >
          {formError && (
            <Alert tone="danger" className="mb-3">
              {formError}
            </Alert>
          )}

          {!editing && (
            <>
              <dl className="grid gap-4 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-muted">Date &amp; time</dt>
                  <dd className="mt-0.5 font-medium">
                    {formatDate(selected.date)} · {formatTime(selected.time)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Doctor</dt>
                  <dd className="mt-0.5 font-medium">{doctorName(selected)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Patient</dt>
                  <dd className="mt-0.5 font-medium">
                    {selected.patient_name} · {selected.age}y · {selected.sex}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Contact</dt>
                  <dd className="mt-0.5 font-medium">
                    {selected.phone}
                    <span className="block text-xs font-normal text-muted">{selected.email}</span>
                  </dd>
                </div>
              </dl>

              <p className="mt-4 text-xs text-muted">
                {EMAIL_LABELS[selected.confirmation_email_status] ??
                  selected.confirmation_email_status}
              </p>

              {selected.status === "cancelled" ? (
                <Alert tone="info" className="mt-4">
                  This visit was cancelled. Book a new appointment whenever you are ready.
                </Alert>
              ) : confirmingCancel ? (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50/60 p-3 dark:border-red-900 dark:bg-red-950/30">
                  <p className="text-xs text-red-700 dark:text-red-300">
                    Cancel this appointment? The slot will be released for other patients.
                  </p>
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    <Button
                      variant="danger"
                      size="sm"
                      loading={cancelling}
                      onClick={() => void handleCancel(selected)}
                    >
                      Yes, cancel visit
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={cancelling}
                      onClick={() => setConfirmingCancel(false)}
                    >
                      Keep it
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => startEditing(selected)}>
                    Edit details
                  </Button>
                  <Button variant="danger" size="sm" onClick={() => setConfirmingCancel(true)}>
                    Cancel visit
                  </Button>
                </div>
              )}
            </>
          )}

          {editing && form && (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Patient name" htmlFor="edit-name">
                  <TextInput
                    id="edit-name"
                    value={form.patient_name}
                    onChange={(event) => setForm({ ...form, patient_name: event.target.value })}
                  />
                </Field>
                <Field label="Age" htmlFor="edit-age">
                  <TextInput
                    id="edit-age"
                    type="number"
                    min={0}
                    max={120}
                    inputMode="numeric"
                    value={form.age}
                    onChange={(event) => setForm({ ...form, age: event.target.value })}
                  />
                </Field>
                <Field label="Sex" htmlFor="edit-sex">
                  <SelectInput
                    id="edit-sex"
                    value={form.sex}
                    onChange={(event) => setForm({ ...form, sex: event.target.value })}
                  >
                    {SEX_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option.charAt(0).toUpperCase() + option.slice(1)}
                      </option>
                    ))}
                  </SelectInput>
                </Field>
                <Field label="Contact number" htmlFor="edit-phone">
                  <TextInput
                    id="edit-phone"
                    inputMode="tel"
                    value={form.phone}
                    onChange={(event) => setForm({ ...form, phone: event.target.value })}
                  />
                </Field>
              </div>

              <p className="text-xs text-muted">
                Confirmations go to{" "}
                <span className="font-medium text-foreground">{selected.email}</span>. That address
                links this booking to your account, so it cannot be changed here.
              </p>

              <div className="rounded-xl border border-line p-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Date" htmlFor="edit-date">
                    <TextInput
                      id="edit-date"
                      type="date"
                      min={today}
                      value={form.date}
                      onChange={(event) => setForm({ ...form, date: event.target.value })}
                    />
                  </Field>
                  <Field label="Time" htmlFor="edit-time">
                    <TextInput
                      id="edit-time"
                      type="time"
                      value={form.time}
                      onChange={(event) => setForm({ ...form, time: event.target.value })}
                    />
                  </Field>
                </div>

                <p className="mt-3 text-xs font-medium text-muted">Open slots</p>
                {slotsBusy && <LoadingBlock label="Checking availability…" />}
                {slotState?.error && (
                  <Alert tone="warning" className="mt-2">
                    {slotState.error}
                  </Alert>
                )}
                {!slotsBusy &&
                  slotState?.key === `${selectedRecordId}:${editDate}` &&
                  (slotState.slots.length === 0 ? (
                    <p className="mt-1 text-xs text-muted">
                      No slots are published for this day. Try another date.
                    </p>
                  ) : (
                    <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                      {slotState.slots.map((slot) => {
                        const value = fromApiTime(slot.time);
                        const chosen = value === form.time;
                        return (
                          <li key={slot.time}>
                            <button
                              type="button"
                              disabled={!slot.available && !chosen}
                              aria-pressed={chosen}
                              onClick={() => setForm({ ...form, time: value })}
                              className={cn(
                                "w-full rounded-xl border px-3 py-2 text-xs transition",
                                chosen
                                  ? "border-brand-400 bg-brand-50 text-brand-700 dark:border-brand-600 dark:bg-brand-800/30 dark:text-brand-200"
                                  : slot.available
                                    ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-300 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
                                    : "cursor-not-allowed border-line bg-surface-muted text-muted",
                              )}
                            >
                              <span className="font-medium">{formatTime(slot.time)}</span>
                              <span className="mt-0.5 block text-[11px]">
                                {chosen
                                  ? "current"
                                  : slot.available
                                    ? "open"
                                    : reasonLabel(slot.reason)}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  ))}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button size="sm" loading={saving} onClick={() => void handleSave()}>
                  Save changes
                </Button>
                <Button variant="secondary" size="sm" disabled={saving} onClick={stopEditing}>
                  Discard
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      <Card
        className="mt-5"
        title="Your visits"
        subtitle={
          appointments === null
            ? "Loading…"
            : `${visible.length} of ${sorted.length} appointment${sorted.length === 1 ? "" : "s"}`
        }
        action={
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((option) => (
              <button
                key={option.key}
                type="button"
                aria-pressed={filter === option.key}
                onClick={() => setFilter(option.key)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                  filter === option.key
                    ? "border-brand-300 bg-brand-50 text-brand-700 dark:border-brand-700 dark:bg-brand-800/30 dark:text-brand-200"
                    : "border-line bg-surface text-muted hover:bg-surface-muted hover:text-foreground",
                )}
              >
                {option.label}
                <span className="ml-1 text-muted">{filterCounts[option.key]}</span>
              </button>
            ))}
          </div>
        }
      >
        {appointments === null && <LoadingBlock label="Loading your appointments…" />}

        {appointments !== null && visible.length === 0 && (
          <EmptyState
            icon={<IconCalendarCheck className="h-5 w-5" />}
            title={
              filter === "cancelled"
                ? "No cancelled visits"
                : filter === "past"
                  ? "No past visits yet"
                  : "No upcoming visits"
            }
            description={
              filter === "all"
                ? "Book a visit with the clinic assistant and it will appear here."
                : "Once an appointment matches this view it will show up here."
            }
          />
        )}

        {visible.length > 0 && (
          <ul className="space-y-2">
            {visible.map((appointment) => {
              const isSelected = appointment.id === selectedId;
              return (
                <li key={appointment.id}>
                  <button
                    type="button"
                    aria-expanded={isSelected}
                    onClick={() => selectAppointment(appointment)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition",
                      isSelected
                        ? "border-brand-300 bg-brand-50/60 dark:border-brand-700 dark:bg-brand-800/20"
                        : "border-line bg-surface hover:bg-surface-muted",
                    )}
                  >
                    <Avatar name={appointment.patient_name} />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-medium">
                          {appointment.patient_name}
                        </span>
                        <Badge tone={statusTone(appointment.status)}>
                          {STATUS_LABELS[appointment.status] ?? appointment.status}
                        </Badge>
                      </span>
                      <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                        <span className="inline-flex items-center gap-1">
                          <IconStethoscope className="h-3.5 w-3.5" />
                          {doctorName(appointment)}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <IconCalendarCheck className="h-3.5 w-3.5" />
                          {formatDate(appointment.date)}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <IconClock className="h-3.5 w-3.5" />
                          {formatTime(appointment.time)}
                        </span>
                      </span>
                    </span>
                    <IconChevronDown
                      className={cn(
                        "h-4 w-4 shrink-0 text-muted transition",
                        isSelected && "rotate-180",
                      )}
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </main>
  );
}
