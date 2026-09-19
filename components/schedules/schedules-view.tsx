"use client";

import { useRef, useState, type ChangeEvent } from "react";

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
  TextInput,
} from "@/components/ui";
import { IconUsers } from "@/components/icons";
import { createSchedule, deleteSchedule, updateSchedule } from "@/lib/api";
import { useDoctors } from "@/lib/hooks";
import type { DoctorSchedule, DoctorScheduleInput } from "@/lib/types";
import { errorMessage, formatDate, formatTime, fromApiTime, toApiTime } from "@/lib/utils";

interface ScheduleForm {
  doctor_name: string;
  specialization: string;
  photo_url: string | null;
  start_time: string;
  end_time: string;
  break_start: string;
  break_end: string;
  leave_date: string;
  slot_duration: string;
}

const EMPTY_FORM: ScheduleForm = {
  doctor_name: "",
  specialization: "",
  photo_url: null,
  start_time: "09:00",
  end_time: "17:00",
  break_start: "12:30",
  break_end: "13:30",
  leave_date: "",
  slot_duration: "30",
};

const MAX_DOCTOR_PHOTO_BYTES = 180_000;

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read the selected photo."));
    reader.readAsDataURL(file);
  });
}

export function SchedulesView() {
  const { doctors, loading, error: listError, reload } = useDoctors();
  const photoInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<ScheduleForm>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function patch(next: Partial<ScheduleForm>) {
    setForm((previous) => ({ ...previous, ...next }));
  }

  function validate(): string | null {
    if (form.doctor_name.trim().length < 2) return "Doctor name must be at least 2 characters.";
    if (!form.start_time || !form.end_time) return "Start and end time are required.";
    if (form.end_time <= form.start_time) return "End time must be after start time.";
    if (form.break_start && form.break_end && form.break_end <= form.break_start) {
      return "Break end must be after break start.";
    }
    const duration = Number(form.slot_duration);
    if (!duration || duration < 5 || duration > 240) {
      return "Visit length must be between 5 and 240 minutes.";
    }
    return null;
  }

  function startEdit(schedule: DoctorSchedule) {
    setEditingId(schedule.id);
    setError(null);
    setNotice(null);
    setForm({
      doctor_name: schedule.doctor_name,
      specialization: schedule.specialization ?? "",
      photo_url: schedule.photo_url,
      start_time: fromApiTime(schedule.start_time),
      end_time: fromApiTime(schedule.end_time),
      break_start: fromApiTime(schedule.break_start),
      break_end: fromApiTime(schedule.break_end),
      leave_date: schedule.leave_date ?? "",
      slot_duration: String(schedule.slot_duration),
    });
  }

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  async function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);
    setNotice(null);

    if (!file.type.startsWith("image/")) {
      setError("Choose an image file for the doctor photo.");
      return;
    }
    if (file.size > MAX_DOCTOR_PHOTO_BYTES) {
      setError("Choose a smaller doctor photo, under 180 KB.");
      return;
    }

    try {
      patch({ photo_url: await fileToDataUrl(file) });
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }

  async function handleSubmit() {
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }

    const payload: DoctorScheduleInput = {
      doctor_name: form.doctor_name.trim(),
      specialization: form.specialization.trim() || null,
      photo_url: form.photo_url,
      start_time: toApiTime(form.start_time) ?? form.start_time,
      end_time: toApiTime(form.end_time) ?? form.end_time,
      break_start: toApiTime(form.break_start),
      break_end: toApiTime(form.break_end),
      leave_date: form.leave_date || null,
      slot_duration: Number(form.slot_duration),
    };

    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (editingId === null) {
        await createSchedule(payload);
        setNotice(`${payload.doctor_name} added to the roster.`);
      } else {
        await updateSchedule(editingId, payload);
        setNotice(`${payload.doctor_name}'s schedule updated.`);
      }
      resetForm();
      await reload();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(schedule: DoctorSchedule) {
    if (!window.confirm(`Remove ${schedule.doctor_name} from the roster?`)) {
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await deleteSchedule(schedule.id);
      if (editingId === schedule.id) resetForm();
      setNotice(`${schedule.doctor_name} removed.`);
      await reload();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page-shell">
      <PageHeader
        title="Doctors & schedules"
        description="Manage who patients can book with, and when."
      />

      <div className="mt-5 grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
        <Card
          title={editingId === null ? "Add a doctor" : `Edit ${form.doctor_name || "doctor"}`}
          subtitle="Working hours, breaks and visit length."
          action={
            editingId !== null ? (
              <Button variant="ghost" size="sm" onClick={resetForm} disabled={busy}>
                Cancel
              </Button>
            ) : null
          }
        >
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Avatar name={form.doctor_name || "Doctor"} imageUrl={form.photo_url} className="h-16 w-16 text-lg" />
              <div className="flex flex-wrap gap-2">
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => void handlePhotoChange(event)}
                />
                <Button type="button" variant="secondary" size="sm" onClick={() => photoInputRef.current?.click()}>
                  Add photo
                </Button>
                {form.photo_url && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => patch({ photo_url: null })}>
                    Remove
                  </Button>
                )}
              </div>
            </div>

            <Field label="Doctor name" htmlFor="schedule-name">
              <TextInput
                id="schedule-name"
                value={form.doctor_name}
                placeholder="Dr. Anjali Verma"
                onChange={(event) => patch({ doctor_name: event.target.value })}
              />
            </Field>

            <Field label="Specialization" hint="optional" htmlFor="schedule-specialization">
              <TextInput
                id="schedule-specialization"
                value={form.specialization}
                placeholder="Cardiology"
                onChange={(event) => patch({ specialization: event.target.value })}
              />
            </Field>

            <p className="pt-1 text-[11px] font-medium uppercase tracking-wide text-muted">
              Working hours
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="From" htmlFor="schedule-start">
                <TextInput
                  id="schedule-start"
                  type="time"
                  value={form.start_time}
                  onChange={(event) => patch({ start_time: event.target.value })}
                />
              </Field>
              <Field label="To" htmlFor="schedule-end">
                <TextInput
                  id="schedule-end"
                  type="time"
                  value={form.end_time}
                  onChange={(event) => patch({ end_time: event.target.value })}
                />
              </Field>
            </div>

            <p className="pt-1 text-[11px] font-medium uppercase tracking-wide text-muted">
              Lunch break
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="From" htmlFor="schedule-break-start">
                <TextInput
                  id="schedule-break-start"
                  type="time"
                  value={form.break_start}
                  onChange={(event) => patch({ break_start: event.target.value })}
                />
              </Field>
              <Field label="To" htmlFor="schedule-break-end">
                <TextInput
                  id="schedule-break-end"
                  type="time"
                  value={form.break_end}
                  onChange={(event) => patch({ break_end: event.target.value })}
                />
              </Field>
            </div>

            <p className="pt-1 text-[11px] font-medium uppercase tracking-wide text-muted">
              Time off & visits
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Away on" hint="optional" htmlFor="schedule-leave">
                <TextInput
                  id="schedule-leave"
                  type="date"
                  value={form.leave_date}
                  onChange={(event) => patch({ leave_date: event.target.value })}
                />
              </Field>
              <Field label="Visit length" hint="minutes" htmlFor="schedule-duration">
                <TextInput
                  id="schedule-duration"
                  type="number"
                  min={5}
                  max={240}
                  value={form.slot_duration}
                  onChange={(event) => patch({ slot_duration: event.target.value })}
                />
              </Field>
            </div>

            {error && <Alert tone="danger">{error}</Alert>}
            {notice && <Alert tone="success">{notice}</Alert>}

            <Button className="w-full" onClick={() => void handleSubmit()} loading={busy}>
              {editingId === null ? "Add doctor" : "Save changes"}
            </Button>
          </div>
        </Card>

        <Card
          title="Our doctors"
          subtitle={`${doctors.length} doctor${doctors.length === 1 ? "" : "s"} on the roster`}
          action={
            <Button variant="ghost" size="sm" onClick={() => void reload()} disabled={busy}>
              Refresh
            </Button>
          }
        >
          {loading ? (
            <LoadingBlock label="Loading schedules…" />
          ) : listError ? (
            <Alert tone="danger">{listError}</Alert>
          ) : doctors.length === 0 ? (
            <EmptyState
              icon={<IconUsers className="h-5 w-5" />}
              title="No doctors yet"
              description="Add your first doctor with the form on the left — they'll be bookable right away."
            />
          ) : (
            <div className="scroll-thin -mx-2 overflow-x-auto px-2">
              <table className="w-full min-w-[680px] border-collapse text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted">
                    <th className="pb-2 pr-3 font-medium">Doctor</th>
                    <th className="pb-2 pr-3 font-medium">Working hours</th>
                    <th className="pb-2 pr-3 font-medium">Lunch break</th>
                    <th className="pb-2 pr-3 font-medium">Visit length</th>
                    <th className="pb-2 pr-3 font-medium">Time off</th>
                    <th className="pb-2 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {doctors.map((doctor) => (
                    <tr key={doctor.id} className="border-t border-line align-top">
                      <td className="py-2.5 pr-3">
                        <span className="flex items-center gap-2.5">
                          <Avatar name={doctor.doctor_name} imageUrl={doctor.photo_url} />
                          <span className="flex flex-col">
                            <span className="font-medium">{doctor.doctor_name}</span>
                            <span className="text-[11px] text-muted">
                              {doctor.specialization ?? "General practice"}
                            </span>
                          </span>
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 text-xs">
                        {formatTime(doctor.start_time)} – {formatTime(doctor.end_time)}
                      </td>
                      <td className="py-2.5 pr-3 text-xs text-muted">
                        {doctor.break_start && doctor.break_end
                          ? `${formatTime(doctor.break_start)} – ${formatTime(doctor.break_end)}`
                          : "—"}
                      </td>
                      <td className="py-2.5 pr-3 text-xs">
                        <Badge tone="neutral">{doctor.slot_duration} min</Badge>
                      </td>
                      <td className="py-2.5 pr-3 text-xs">
                        {doctor.leave_date ? (
                          <Badge tone="warning">{formatDate(doctor.leave_date)}</Badge>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="py-2.5">
                        <div className="flex justify-end gap-1.5">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => startEdit(doctor)}
                            disabled={busy}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => void handleDelete(doctor)}
                            disabled={busy}
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </main>
  );
}
