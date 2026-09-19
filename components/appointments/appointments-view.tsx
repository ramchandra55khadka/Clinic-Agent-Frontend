"use client";

import { useEffect, useState } from "react";

import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  LoadingBlock,
  PageHeader,
  SelectInput,
  StatCard,
} from "@/components/ui";
import { IconCalendarCheck, IconUsers } from "@/components/icons";
import { listAppointments } from "@/lib/api";
import { doctorLabel, useDoctors } from "@/lib/hooks";
import type { Appointment } from "@/lib/types";
import { errorMessage, formatDate, formatTime, todayIso } from "@/lib/utils";

export function AppointmentsView() {
  const { doctors, loading: doctorsLoading, error: doctorsError, reload } = useDoctors();

  const [selectedDoctorId, setSelectedDoctorId] = useState("");
  const [refreshToken, setRefreshToken] = useState(0);
  const [result, setResult] = useState<{
    key: string;
    appointments: Appointment[];
    error: string | null;
  } | null>(null);

  /* Default to the first doctor without needing a state-syncing effect. */
  const doctorId = selectedDoctorId || (doctors[0] ? String(doctors[0].id) : "");
  const requestKey = `${doctorId}:${refreshToken}`;

  useEffect(() => {
    if (!doctorId) return;
    const key = requestKey;
    let active = true;

    listAppointments(Number(doctorId))
      .then((rows) => {
        if (active) setResult({ key, appointments: rows, error: null });
      })
      .catch((cause) => {
        if (active) setResult({ key, appointments: [], error: errorMessage(cause) });
      });

    return () => {
      active = false;
    };
  }, [doctorId, requestKey]);

  const appointments = result?.appointments ?? [];
  const error = result?.error ?? null;
  const busy = doctorId !== "" && result?.key !== requestKey;

  const selectedDoctor = doctors.find((doctor) => String(doctor.id) === doctorId) ?? null;
  const today = todayIso();
  const todaysCount = appointments.filter((appointment) => appointment.date === today).length;
  const upcomingCount = appointments.filter((appointment) => appointment.date >= today).length;
  const sentCount = appointments.filter(
    (appointment) => appointment.confirmation_email_status === "sent",
  ).length;

  const statusLabel: Record<string, string> = {
    confirmed: "Confirmed",
    cancelled: "Cancelled",
  };
  const emailLabel: Record<string, string> = {
    sent: "Sent",
    pending: "Pending",
  };

  return (
    <main className="page-shell">
      <PageHeader
        title="Appointments"
        description="Every visit booked through the clinic assistant, at a glance."
      />

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <StatCard label="Upcoming" value={upcomingCount} tone="brand" />
        <StatCard label="Today" value={todaysCount} />
        <StatCard label="Confirmations sent" value={sentCount} tone="success" />
      </div>

      <Card
        className="mt-5"
        title="Doctor"
        action={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setRefreshToken((value) => value + 1)}
            disabled={busy || !doctorId}
          >
            Refresh
          </Button>
        }
      >
        <SelectInput
          value={doctorId}
          onChange={(event) => setSelectedDoctorId(event.target.value)}
          disabled={doctorsLoading}
          aria-label="Doctor"
        >
          <option value="">Select a doctor…</option>
          {doctors.map((doctor) => (
            <option key={doctor.id} value={String(doctor.id)}>
              {doctorLabel(doctor)}
            </option>
          ))}
        </SelectInput>

        {doctorsError && (
          <Alert tone="danger" className="mt-3">
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
      </Card>

      <Card
        title={selectedDoctor ? selectedDoctor.doctor_name : "Appointments"}
        subtitle={
          busy
            ? "Loading…"
            : `${appointments.length} appointment${appointments.length === 1 ? "" : "s"}`
        }
      >
        {busy ? (
          <LoadingBlock label="Loading appointments…" />
        ) : error ? (
          <Alert tone="danger">{error}</Alert>
        ) : !doctorId ? (
          <EmptyState
            icon={<IconUsers className="h-5 w-5" />}
            title="Select a doctor"
            description="Choose a doctor to see their booked visits."
          />
        ) : appointments.length === 0 ? (
          <EmptyState
            icon={<IconCalendarCheck className="h-5 w-5" />}
            title="No appointments yet"
            description="Book one from the Assistant page and it will show up here instantly."
          />
        ) : (
          <div className="scroll-thin -mx-2 overflow-x-auto px-2">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="text-left text-xs text-muted">
                  <th className="pb-2 pr-3 font-medium">Patient</th>
                  <th className="pb-2 pr-3 font-medium">Age / Sex</th>
                  <th className="pb-2 pr-3 font-medium">Contact</th>
                  <th className="pb-2 pr-3 font-medium">When</th>
                  <th className="pb-2 pr-3 font-medium">Status</th>
                  <th className="pb-2 font-medium">Confirmation</th>
                </tr>
              </thead>
              <tbody>
                {appointments.map((appointment) => (
                  <tr key={appointment.id} className="border-t border-line align-top">
                    <td className="py-2.5 pr-3">
                      <span className="flex items-center gap-2.5">
                        <Avatar name={appointment.patient_name} />
                        <span className="flex flex-col">
                          <span className="font-medium">{appointment.patient_name}</span>
                          <span className="text-[11px] text-muted">#{appointment.id}</span>
                        </span>
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 text-xs text-muted">
                      {appointment.age} / {appointment.sex}
                    </td>
                    <td className="py-2.5 pr-3 text-xs text-muted">
                      <span className="block">{appointment.email}</span>
                      <span className="block">{appointment.phone}</span>
                    </td>
                    <td className="py-2.5 pr-3 text-xs">
                      <span className="block font-medium">{formatDate(appointment.date)}</span>
                      <span className="block text-muted">{formatTime(appointment.time)}</span>
                    </td>
                    <td className="py-2.5 pr-3">
                      <Badge tone={appointment.status === "cancelled" ? "danger" : "success"}>
                        {statusLabel[appointment.status] ?? appointment.status}
                      </Badge>
                    </td>
                    <td className="py-2.5">
                      <Badge
                        tone={
                          appointment.confirmation_email_status === "sent" ? "brand" : "neutral"
                        }
                      >
                        {emailLabel[appointment.confirmation_email_status] ??
                          appointment.confirmation_email_status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </main>
  );
}