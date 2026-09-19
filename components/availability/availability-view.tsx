"use client";

import { useState } from "react";

import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  LoadingBlock,
  PageHeader,
  SelectInput,
  TextInput,
} from "@/components/ui";
import { checkAvailability, getSchedule } from "@/lib/api";
import { doctorLabel, useDoctors } from "@/lib/hooks";
import type { AvailabilityResponse, DoctorSchedule } from "@/lib/types";
import {
  cn,
  errorMessage,
  formatDate,
  formatTime,
  reasonLabel,
  toApiTime,
  todayIso,
} from "@/lib/utils";

export function AvailabilityView() {
  const { doctors, loading: doctorsLoading, error: doctorsError, reload } = useDoctors();

  const [doctorId, setDoctorId] = useState("");
  const [date, setDate] = useState(todayIso());
  const [time, setTime] = useState("");
  const [schedule, setSchedule] = useState<DoctorSchedule | null>(null);
  const [result, setResult] = useState<AvailabilityResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function check() {
    if (!doctorId || !date) return;
    setBusy(true);
    setError(null);
    try {
      const [availability, doctorSchedule] = await Promise.all([
        checkAvailability({ doctor_id: Number(doctorId), date, time: toApiTime(time) }),
        getSchedule(Number(doctorId)).catch(() => null),
      ]);
      setResult(availability);
      setSchedule(doctorSchedule);
    } catch (cause) {
      setError(errorMessage(cause));
      setResult(null);
      setSchedule(null);
    } finally {
      setBusy(false);
    }
  }

  const availableCount = result?.slots.filter((slot) => slot.available).length ?? 0;

  return (
    <main className="page-shell">
      <PageHeader
        title="Availability"
        description="See when each doctor is free, slot by slot."
      />

      <div className="mt-5 grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
        <Card title="Find a time" subtitle="Choose a doctor and a date — we'll show every slot.">
          <div className="space-y-3">
            <Field label="Doctor" htmlFor="availability-doctor">
              <SelectInput
                id="availability-doctor"
                value={doctorId}
                onChange={(event) => setDoctorId(event.target.value)}
                disabled={doctorsLoading}
              >
                <option value="">Select a doctor…</option>
                {doctors.map((doctor) => (
                  <option key={doctor.id} value={String(doctor.id)}>
                    {doctorLabel(doctor)}
                  </option>
                ))}
              </SelectInput>
            </Field>

            <Field label="Date" htmlFor="availability-date">
              <TextInput
                id="availability-date"
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </Field>

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
              onClick={() => void check()}
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
          {busy && <LoadingBlock label="Querying slots…" />}

          {error && <Alert tone="danger">{error}</Alert>}

          {!busy && !error && !result && (
            <EmptyState
              title="No result yet"
              description="Choose a doctor and date, then press “Check availability”."
            />
          )}

          {result && !busy && (
            <>
              <Card
                title={formatDate(result.date)}
                subtitle={
                  schedule
                    ? `${schedule.doctor_name} · ${formatTime(schedule.start_time)}–${formatTime(
                        schedule.end_time,
                      )} · ${schedule.slot_duration} min slots`
                    : `Doctor #${result.doctor_id}`
                }
                action={
                  <Badge tone={result.available ? "success" : "danger"}>
                    {result.available ? "Available" : "Fully booked"}
                  </Badge>
                }
              >
                <dl className="grid gap-3 text-xs sm:grid-cols-3">
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
                    <dt className="text-muted">Free slots</dt>
                    <dd className="mt-0.5 font-medium">
                      {availableCount} / {result.slots.length}
                    </dd>
                  </div>
                </dl>

                {result.reason && (
                  <Alert tone="warning" className="mt-3">
                    Requested time is unavailable: {reasonLabel(result.reason)}
                  </Alert>
                )}
              </Card>

              <Card title="Slots" subtitle="Green slots are open for booking.">
                {result.slots.length === 0 ? (
                  <EmptyState
                    title="This doctor has no schedule yet"
                    description="Add their working hours on the Doctors page, then check again."
                  />
                ) : (
                  <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                    {result.slots.map((slot) => (
                      <li
                        key={slot.time}
                        className={cn(
                          "rounded-xl border px-3 py-2 text-xs",
                          slot.available
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
                            : "border-line bg-surface-muted text-muted",
                        )}
                      >
                        <p className="font-medium">{formatTime(slot.time)}</p>
                        <p className="mt-0.5 text-[11px]">
                          {slot.available ? "open" : reasonLabel(slot.reason)}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </>
          )}
        </div>
      </div>
    </main>
  );
}