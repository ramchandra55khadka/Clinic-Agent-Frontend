"use client";

import {
  Alert,
  Badge,
  Button,
  Card,
  Field,
  SelectInput,
  TextInput,
} from "@/components/ui";
import { doctorLabel } from "@/lib/hooks";
import { contextProblems, patientProblems } from "@/lib/patient";
import type { DoctorSchedule, PatientDraft } from "@/lib/types";
import { formatDate, formatTime, todayIso } from "@/lib/utils";

export interface ContextValue {
  doctorId: string;
  date: string;
  time: string;
}

export interface ContextPanelProps {
  doctors: DoctorSchedule[];
  doctorsLoading: boolean;
  doctorsError: string | null;
  onReloadDoctors: () => void;
  context: ContextValue;
  onContextChange: (patch: Partial<ContextValue>) => void;
  patient: PatientDraft;
  onPatientChange: (patch: Partial<PatientDraft>) => void;
  onCheckAvailability: () => void;
  onBook: () => void;
  onReset: () => void;
  busy: boolean;
}

export function ContextPanel({
  doctors,
  doctorsLoading,
  doctorsError,
  onReloadDoctors,
  context,
  onContextChange,
  patient,
  onPatientChange,
  onCheckAvailability,
  onBook,
  onReset,
  busy,
}: ContextPanelProps) {
  const selectedDoctor = doctors.find((doctor) => String(doctor.id) === context.doctorId);
  const contextMissing = contextProblems(context.doctorId, context.date);

  return (
    <div className="space-y-4">
      <Card
        title="Appointment details"
        subtitle="Who you're seeing, and when."
        action={
          <Button variant="ghost" size="sm" onClick={onReset} disabled={busy}>
            Reset
          </Button>
        }
      >
        <div className="space-y-3">
          <Field label="Doctor" htmlFor="context-doctor">
            <SelectInput
              id="context-doctor"
              value={context.doctorId}
              onChange={(event) => onContextChange({ doctorId: event.target.value })}
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

          <div className="grid grid-cols-2 gap-3">
            <Field label="Date" htmlFor="context-date">
              <TextInput
                id="context-date"
                type="date"
                value={context.date}
                min={todayIso()}
                onChange={(event) => onContextChange({ date: event.target.value })}
              />
            </Field>
            <Field label="Time" hint="optional" htmlFor="context-time">
              <TextInput
                id="context-time"
                type="time"
                value={context.time}
                onChange={(event) => onContextChange({ time: event.target.value })}
              />
            </Field>
          </div>

          {doctorsError && (
            <Alert tone="danger">
              {doctorsError}
              <button
                type="button"
                onClick={onReloadDoctors}
                className="ml-1 font-medium underline underline-offset-2"
              >
                Retry
              </button>
            </Alert>
          )}

          {!doctorsLoading && !doctorsError && doctors.length === 0 && (
            <Alert tone="info">
              No doctors yet. Add one on the <strong>Doctors</strong> page first.
            </Alert>
          )}

          {contextMissing.length > 0 ? (
            <Alert tone="warning">Still needed: {contextMissing.join(", ")}</Alert>
          ) : (
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
              <Badge tone="brand">
                {selectedDoctor ? selectedDoctor.doctor_name : `Doctor #${context.doctorId}`}
              </Badge>
              {context.date && <Badge tone="neutral">{formatDate(context.date)}</Badge>}
              {context.time && <Badge tone="neutral">{formatTime(context.time)}</Badge>}
            </div>
          )}

          <Button
            variant="secondary"
            size="sm"
            className="w-full"
            onClick={onCheckAvailability}
            disabled={contextMissing.length > 0 || busy}
          >
            Check availability
          </Button>
        </div>
      </Card>

      <PatientCard
        patient={patient}
        onPatientChange={onPatientChange}
        onBook={onBook}
        busy={busy}
        contextReady={contextMissing.length === 0 && Boolean(context.time)}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Patient form                                                        */
/* ------------------------------------------------------------------ */

function PatientCard({
  patient,
  onPatientChange,
  onBook,
  busy,
  contextReady,
}: {
  patient: PatientDraft;
  onPatientChange: (patch: Partial<PatientDraft>) => void;
  onBook: () => void;
  busy: boolean;
  contextReady: boolean;
}) {
  const problems = patientProblems(patient);

  return (
    <Card title="Patient details" subtitle="Used to confirm your booking.">
      <div className="space-y-3">
        <Field label="Full name" htmlFor="patient-name">
          <TextInput
            id="patient-name"
            value={patient.patient_name}
            placeholder="Sita Sharma"
            autoComplete="name"
            onChange={(event) => onPatientChange({ patient_name: event.target.value })}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Age" htmlFor="patient-age">
            <TextInput
              id="patient-age"
              type="number"
              min={0}
              max={130}
              inputMode="numeric"
              value={patient.age}
              placeholder="30"
              onChange={(event) => onPatientChange({ age: event.target.value })}
            />
          </Field>
          <Field label="Sex" htmlFor="patient-sex">
            <SelectInput
              id="patient-sex"
              value={patient.sex}
              onChange={(event) => onPatientChange({ sex: event.target.value })}
            >
              <option value="">Select…</option>
              <option value="Female">Female</option>
              <option value="Male">Male</option>
              <option value="Other">Other</option>
            </SelectInput>
          </Field>
        </div>

        <Field label="Email" htmlFor="patient-email">
          <TextInput
            id="patient-email"
            type="email"
            value={patient.email}
            placeholder="patient@example.com"
            autoComplete="email"
            onChange={(event) => onPatientChange({ email: event.target.value })}
          />
        </Field>

        <Field label="Phone" htmlFor="patient-phone">
          <TextInput
            id="patient-phone"
            type="tel"
            value={patient.phone}
            placeholder="9866835892"
            autoComplete="tel"
            onChange={(event) => onPatientChange({ phone: event.target.value })}
          />
        </Field>

        {!contextReady && (
          <Alert tone="warning">Select a doctor, date and time before booking.</Alert>
        )}

        {contextReady && problems.length > 0 && (
          <Alert tone="warning">Still needed: {problems.join(", ")}</Alert>
        )}

        <Button
          className="w-full"
          onClick={onBook}
          loading={busy}
          disabled={!contextReady || problems.length > 0}
        >
          Book appointment
        </Button>
      </div>
    </Card>
  );
}