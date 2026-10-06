"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";

import {
  Alert,
  Avatar,
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  Field,
  LoadingBlock,
  Modal,
  SelectInput,
  TextArea,
  TextInput,
} from "@/components/ui";
import { toast } from "@/components/toast";
import {
  IconCalendarDays,
  IconClock,
  IconClose,
  IconDots,
  IconEye,
  IconMail,
  IconPencil,
  IconPhone,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconShieldCheck,
  IconStethoscope,
  IconTrash,
  LogoMark,
} from "@/components/icons";
import { createSchedule, deleteSchedule, updateSchedule } from "@/lib/api";
import { useDoctors } from "@/lib/hooks";
import type { DoctorEducation, DoctorSchedule, DoctorScheduleInput } from "@/lib/types";
import { WEEKDAYS, cn, errorMessage, formatDate, formatTime, fromApiTime, toApiTime } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Local form state                                                    */
/* ------------------------------------------------------------------ */

type TabKey = "doctors" | "schedule";

interface EducationForm {
  degree: string;
  institution: string;
  field_of_study: string;
  start_date: string;
  end_date: string;
  description: string;
}

/** The doctor-profile form (no schedule hours: those live in Doctor Schedule). */
interface DoctorFormState {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  date_of_birth: string;
  gender: string;
  address: string;
  photo_url: string | null;
  license_number: string;
  specialization: string;
  qualification: string;
  experience_years: string;
  bio: string;
  consultation_fee: string;
  consultation_duration: string;
  is_verified: boolean;
  educations: EducationForm[];
}

/** The schedule form: which doctor, which weekdays, which hours. */
interface ScheduleFormState {
  doctor_id: string;
  days: string[];
  start_time: string;
  end_time: string;
  break_start: string;
  break_end: string;
  leave_date: string;
  slot_duration: string;
}

const GENDER_OPTIONS = ["Male", "Female", "Other"] as const;
const MAX_DOCTOR_PHOTO_BYTES = 5_000_000;
const DEFAULT_START_TIME = "09:00";
const DEFAULT_END_TIME = "17:00";
const DEFAULT_SLOT_DURATION = "30";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function emptyDoctorForm(): DoctorFormState {
  return {
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    date_of_birth: "",
    gender: "",
    address: "",
    photo_url: null,
    license_number: "",
    specialization: "",
    qualification: "",
    experience_years: "",
    bio: "",
    consultation_fee: "",
    consultation_duration: "",
    is_verified: false,
    educations: [emptyEducation()],
  };
}

function doctorFormFrom(doctor: DoctorSchedule): DoctorFormState {
  return {
    first_name: doctor.first_name || "",
    last_name: doctor.last_name || "",
    email: doctor.email || "",
    phone: doctor.phone || "",
    date_of_birth: doctor.date_of_birth || "",
    gender: doctor.gender || "",
    address: doctor.address || "",
    photo_url: doctor.photo_url,
    license_number: doctor.license_number || "",
    specialization: doctor.specialization || "",
    qualification: doctor.qualification || "",
    experience_years: String(doctor.experience_years ?? ""),
    bio: doctor.bio || "",
    consultation_fee: String(doctor.consultation_fee ?? ""),
    consultation_duration: String(doctor.consultation_duration ?? ""),
    is_verified: doctor.is_verified || false,
    educations:
      doctor.educations && doctor.educations.length > 0
        ? doctor.educations.map((education) => ({
            degree: education.degree || "",
            institution: education.institution || "",
            field_of_study: education.field_of_study || "",
            start_date: education.start_date || "",
            end_date: education.end_date || "",
            description: education.description || "",
          }))
        : [emptyEducation()],
  };
}

/** Weekdays a doctor works; the backend reports all seven when unset. */
function workingDays(doctor: DoctorSchedule): string[] {
  return doctor.days && doctor.days.length > 0 ? [...doctor.days] : [...WEEKDAYS];
}

function scheduleFormFrom(doctor: DoctorSchedule | null): ScheduleFormState {
  return {
    doctor_id: doctor ? String(doctor.id) : "",
    days: doctor ? workingDays(doctor) : [...WEEKDAYS],
    start_time: fromApiTime(doctor?.start_time) || DEFAULT_START_TIME,
    end_time: fromApiTime(doctor?.end_time) || DEFAULT_END_TIME,
    break_start: fromApiTime(doctor?.break_start),
    break_end: fromApiTime(doctor?.break_end),
    leave_date: doctor?.leave_date || "",
    slot_duration: String(doctor?.slot_duration ?? DEFAULT_SLOT_DURATION),
  };
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read the selected photo."));
    reader.readAsDataURL(file);
  });
}

function parseMinutes(value?: string | null): number {
  const [hours, minutes] = fromApiTime(value).split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return 0;
  return hours * 60 + minutes;
}

function scheduleSlots(doctor: DoctorSchedule): number {
  const workMinutes = parseMinutes(doctor.end_time) - parseMinutes(doctor.start_time);
  const breakMinutes =
    doctor.break_start && doctor.break_end
      ? Math.max(0, parseMinutes(doctor.break_end) - parseMinutes(doctor.break_start))
      : 0;
  return Math.max(0, Math.floor((workMinutes - breakMinutes) / (doctor.slot_duration || 30)));
}

function compactEducation(row: EducationForm): DoctorEducation | null {
  const hasAnyValue = Object.values(row).some((value) => value.trim());
  if (!hasAnyValue) return null;
  return {
    degree: row.degree.trim(),
    institution: row.institution.trim(),
    field_of_study: row.field_of_study.trim() || null,
    start_date: row.start_date || null,
    end_date: row.end_date || null,
    description: row.description.trim() || null,
  };
}

function educationLabel(education: DoctorEducation): string {
  return [education.degree, education.field_of_study].filter(Boolean).join(", ");
}

function experienceLabel(doctor: DoctorSchedule): string {
  return doctor.experience_years !== null && doctor.experience_years !== undefined
    ? `${doctor.experience_years} years`
    : "—";
}

function emptyEducation(): EducationForm {
  return { degree: "", institution: "", field_of_study: "", start_date: "", end_date: "", description: "" };
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function SchedulesView() {
  const { doctors, loading, error: listError, reload } = useDoctors();

  const [tab, setTab] = useState<TabKey>("doctors");
  const [search, setSearch] = useState("");
  const [doctorFilter, setDoctorFilter] = useState("");
  const [dayFilter, setDayFilter] = useState("");
  const [doctorModal, setDoctorModal] = useState<{ mode: "create" | "edit"; doctor: DoctorSchedule | null } | null>(
    null,
  );
  const [scheduleModal, setScheduleModal] = useState<{ doctorId: number | null } | null>(null);
  const [viewing, setViewing] = useState<DoctorSchedule | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<DoctorSchedule | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  /* One row per doctor per working day — drives the sidebar badge. */
  const scheduleCount = useMemo(
    () => doctors.reduce((total, doctor) => total + workingDays(doctor).length, 0),
    [doctors],
  );

  function flash(message: string) {
    setError(null);
    toast.success(message);
  }

  function openCreateDoctor() {
    setError(null);
    setDoctorModal({ mode: "create", doctor: null });
  }

  function openEditDoctor(doctor: DoctorSchedule) {
    setError(null);
    setDoctorModal({ mode: "edit", doctor });
  }

  function openSchedule(doctor: DoctorSchedule | null) {
    setError(null);
    if (!doctor && doctors.length === 0) {
      setError("Add a doctor first — every schedule belongs to a doctor.");
      return;
    }
    setScheduleModal({ doctorId: doctor?.id ?? null });
  }

  /** Saves a new doctor (with default hours) or an edited profile. */
  async function createDoctor(payload: DoctorScheduleInput) {
    const saved = await createSchedule(payload);
    await reload();
    flash(`${saved.doctor_name} added to the roster.`);
    setDoctorModal(null);
  }

  async function updateDoctor(doctorId: number, payload: Partial<DoctorScheduleInput>) {
    const saved = await updateSchedule(doctorId, payload);
    await reload();
    flash(`${saved.doctor_name}'s profile updated.`);
    setDoctorModal(null);
  }

  async function saveSchedule(doctorId: number, payload: Partial<DoctorScheduleInput>) {
    const saved = await updateSchedule(doctorId, payload);
    await reload();
    flash(`Schedule updated for ${saved.doctor_name}.`);
    setScheduleModal(null);
  }

  async function removeDoctor() {
    const target = removeTarget;
    if (!target) return;
    setBusy(true);
    setError(null);
    try {
      await deleteSchedule(target.id);
      if (viewing?.id === target.id) setViewing(null);
      await reload();
      setRemoveTarget(null);
      flash(`${target.doctor_name} removed.`);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }


  return (
    <main className="page-shell">
      {/* Mobile sidebar toggle */}
      <button
        type="button"
        onClick={() => setSidebarOpen(true)}
        aria-label="Open sidebar"
        className="lg:hidden flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium transition hover:bg-surface-muted touch-target"
      >
        <IconDots className="h-5 w-5" />
        Menu
      </button>

      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="drawer-backdrop lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <div className="flex flex-col gap-5 lg:flex-row lg:gap-7">
        <aside className={cn("lg:w-60 lg:shrink-0", sidebarOpen ? "drawer open lg:translate-x-0" : "lg:translate-x-0")}>
          <Sidebar tab={tab} onTabChange={setTab} doctorCount={doctors.length} scheduleCount={scheduleCount} onClose={() => setSidebarOpen(false)} />
        </aside>

        <div className="min-w-0 flex-1 space-y-4">
          {error && <Alert tone="danger">{error}</Alert>}

          {tab === "doctors" ? (
            <DoctorsPanel
              doctors={doctors}
              loading={loading}
              error={listError}
              busy={busy}
              query={search}
              onQueryChange={setSearch}
              onRefresh={() => void reload()}
              onAdd={openCreateDoctor}
              onView={setViewing}
              onEdit={openEditDoctor}
              onSchedule={openSchedule}
              onDelete={setRemoveTarget}
            />
          ) : (
            <SchedulePanel
              doctors={doctors}
              loading={loading}
              error={listError}
              doctorFilter={doctorFilter}
              dayFilter={dayFilter}
              onDoctorFilter={setDoctorFilter}
              onDayFilter={setDayFilter}
              onRefresh={() => void reload()}
              onAdd={() => openSchedule(null)}
              onAddDoctor={() => {
                setTab("doctors");
                openCreateDoctor();
              }}
              onView={setViewing}
              onEdit={openEditDoctor}
              onSchedule={openSchedule}
            />
          )}
        </div>
      </div>

      {doctorModal && (
        <DoctorFormModal
          mode={doctorModal.mode}
          doctor={doctorModal.doctor}
          onClose={() => setDoctorModal(null)}
          onCreate={createDoctor}
          onUpdate={updateDoctor}
        />
      )}
      {scheduleModal && (
        <ScheduleFormModal
          doctors={doctors}
          initialDoctorId={scheduleModal.doctorId}
          onClose={() => setScheduleModal(null)}
          onSubmit={saveSchedule}
        />
      )}
      {viewing && (
        <DoctorViewModal
          doctor={viewing}
          busy={busy}
          onClose={() => setViewing(null)}
          onEdit={() => {
            setViewing(null);
            openEditDoctor(viewing);
          }}
          onSchedule={() => {
            setViewing(null);
            openSchedule(viewing);
          }}
          onDelete={() => setRemoveTarget(viewing)}
        />
      )}

      <ConfirmDialog
        open={removeTarget !== null}
        title="Remove from roster"
        message={
          removeTarget
            ? `Remove ${removeTarget.doctor_name} from the roster? This also deletes their schedule.`
            : ""
        }
        confirmLabel="Remove doctor"
        busy={busy}
        onConfirm={() => void removeDoctor()}
        onClose={() => setRemoveTarget(null)}
      />
    </main>
  );
}


/* ------------------------------------------------------------------ */
/* Sidebar                                                             */
/* ------------------------------------------------------------------ */

function Sidebar({
  tab,
  onTabChange,
  doctorCount,
  scheduleCount,
  onClose,
}: {
  tab: TabKey;
  onTabChange: (tab: TabKey) => void;
  doctorCount: number;
  scheduleCount: number;
  onClose: () => void;
}) {
  const tabs: Array<{ key: TabKey; label: string; icon: ReactNode; count: number }> = [
    { key: "doctors", label: "Doctors", icon: <IconStethoscope className="h-4 w-4" />, count: doctorCount },
    {
      key: "schedule",
      label: "Doctor Schedule",
      icon: <IconCalendarDays className="h-4 w-4" />,
      count: scheduleCount,
    },
  ];

  return (
    <aside className="lg:w-60 lg:shrink-0">
      <div className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-4 shadow-xs lg:sticky lg:top-24">
        {/* Mobile close button */}
        <button
          type="button"
          onClick={onClose}
          className="lg:hidden flex items-center justify-between rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium transition hover:bg-surface-muted touch-target"
        >
          <span>Menu</span>
          <IconClose className="h-5 w-5" />
        </button>

        <Link href="/" className="flex items-center gap-2.5 rounded-lg px-1 py-1 transition hover:bg-surface-muted">
          <LogoMark className="h-8 w-8" />
          <span className="flex flex-col leading-tight">
            <span className="text-sm font-semibold tracking-tight">Nishant Care</span>
            <span className="text-2xs text-muted">Clinic admin</span>
          </span>
        </Link>

        <nav aria-label="Doctor management" className="flex gap-2 lg:flex-col">
          {tabs.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => {
                onTabChange(item.key);
                onClose();
              }}
              aria-current={tab === item.key ? "page" : undefined}
              className={cn(
                "flex flex-1 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition lg:flex-none touch-target",
                tab === item.key
                  ? "border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-800 dark:bg-brand-800/25 dark:text-brand-200"
                  : "border-transparent text-muted hover:bg-surface-muted hover:text-foreground",
              )}
            >
              {item.icon}
              <span className="flex-1 text-left">{item.label}</span>
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-3xs font-semibold tabular-nums",
                  tab === item.key
                    ? "bg-brand-100 text-brand-700 dark:bg-brand-900/60 dark:text-brand-200"
                    : "bg-surface-muted text-muted",
                )}
              >
                {item.count}
              </span>
            </button>
          ))}
        </nav>

        <p className="hidden text-2xs leading-relaxed text-muted lg:block">
          Manage doctor profiles and the weekly hours patients can book.
        </p>
      </div>
    </aside>
  );
}


/* ------------------------------------------------------------------ */
/* Doctors tab                                                         */
/* ------------------------------------------------------------------ */

interface DoctorsPanelProps {
  doctors: DoctorSchedule[];
  loading: boolean;
  error: string | null;
  busy: boolean;
  query: string;
  onQueryChange: (value: string) => void;
  onRefresh: () => void;
  onAdd: () => void;
  onView: (doctor: DoctorSchedule) => void;
  onEdit: (doctor: DoctorSchedule) => void;
  onSchedule: (doctor: DoctorSchedule) => void;
  onDelete: (doctor: DoctorSchedule) => void;
}

function DoctorsPanel({
  doctors,
  loading,
  error,
  busy,
  query,
  onQueryChange,
  onRefresh,
  onAdd,
  onView,
  onEdit,
  onSchedule,
  onDelete,
}: DoctorsPanelProps) {
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return doctors;
    return doctors.filter((doctor) =>
      [doctor.doctor_name, doctor.specialization, doctor.qualification, doctor.email]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [doctors, query]);

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Doctors</h1>
          <p className="mt-0.5 text-xs text-muted">
            {doctors.length === 0
              ? "No doctors on the roster yet."
              : `${doctors.length} doctor${doctors.length === 1 ? "" : "s"} on the roster.`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={onRefresh} disabled={loading}>
            <IconRefresh className="h-4 w-4" />
            Refresh
          </Button>
          <Button onClick={onAdd}>
            <IconPlus className="h-4 w-4" />
            Add Doctor
          </Button>
        </div>
      </header>

      <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-xs">
        <div className="flex items-center gap-2.5 border-b border-line px-4 py-3">
          <IconSearch className="h-4 w-4 shrink-0 text-muted" />
          <input
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search doctor..."
            aria-label="Search doctors"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted/70"
          />
        </div>

        {loading ? (
          <div className="px-4">
            <LoadingBlock label="Loading doctors..." />
          </div>
        ) : error ? (
          <div className="p-4">
            <Alert tone="danger">{error}</Alert>
          </div>
        ) : doctors.length === 0 ? (
          <div className="space-y-3 p-6">
            <EmptyState
              icon={<IconStethoscope className="h-5 w-5" />}
              title="No doctors yet"
              description="Add your first doctor and they become bookable right away."
            />
            <div className="flex justify-center">
              <Button onClick={onAdd}>
                <IconPlus className="h-4 w-4" />
                Add Doctor
              </Button>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="No doctors match your search"
              description={`Nothing matches “${query}”. Try another name or specialization.`}
            />
          </div>
        ) : (


          <div className="table-responsive -mx-2 overflow-x-auto px-2">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-line text-2xs uppercase tracking-wide text-muted">
                  <th className="px-4 py-3 font-medium">Doctor</th>
                  <th className="px-4 py-3 font-medium">Specialization</th>
                  <th className="px-4 py-3 font-medium">Experience</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filtered.map((doctor) => (
                  <tr key={doctor.id} className="transition hover:bg-surface-muted/60">
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => onView(doctor)}
                        className="flex max-w-full items-center gap-3 text-left touch-target"
                      >
                        <Avatar name={doctor.doctor_name} imageUrl={doctor.photo_url} className="h-9 w-9" />
                        <span className="min-w-0">
                          <span className="flex items-center gap-1.5 font-medium">
                            <span className="truncate">{doctor.doctor_name}</span>
                            {doctor.is_verified && (
                              <IconShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-600" aria-label="Verified" />
                            )}
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-muted">
                            {doctor.email || `Doctor #${doctor.id}`}
                          </span>
                        </span>
                      </button>
                    </td>
                    <td className="px-4 py-3 text-muted">{doctor.specialization || "General practice"}</td>
                    <td className="px-4 py-3 tabular-nums">{experienceLabel(doctor)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        <RowMenu
                          label={`Actions for ${doctor.doctor_name}`}
                          items={[
                            {
                              label: "View profile",
                              icon: <IconEye className="h-3.5 w-3.5" />,
                              onSelect: () => onView(doctor),
                            },
                            {
                              label: "Edit profile",
                              icon: <IconPencil className="h-3.5 w-3.5" />,
                              onSelect: () => onEdit(doctor),
                            },
                            {
                              label: "Edit schedule",
                              icon: <IconCalendarDays className="h-3.5 w-3.5" />,
                              onSelect: () => onSchedule(doctor),
                            },
                            {
                              label: "Delete",
                              icon: <IconTrash className="h-3.5 w-3.5" />,
                              danger: true,
                              disabled: busy,
                              onSelect: () => onDelete(doctor),
                            },
                          ]}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}


/* ------------------------------------------------------------------ */
/* Schedule tab                                                        */
/* ------------------------------------------------------------------ */

interface SchedulePanelProps {
  doctors: DoctorSchedule[];
  loading: boolean;
  error: string | null;
  doctorFilter: string;
  dayFilter: string;
  onDoctorFilter: (value: string) => void;
  onDayFilter: (value: string) => void;
  onRefresh: () => void;
  onAdd: () => void;
  /** Empty state: send the user to the Doctors tab to create a doctor. */
  onAddDoctor: () => void;
  onView: (doctor: DoctorSchedule) => void;
  onEdit: (doctor: DoctorSchedule) => void;
  onSchedule: (doctor: DoctorSchedule) => void;
}

/** One displayed schedule row: a doctor on one of their working days. */
interface ScheduleRow {
  doctor: DoctorSchedule;
  day: string;
}

function SchedulePanel({
  doctors,
  loading,
  error,
  doctorFilter,
  dayFilter,
  onDoctorFilter,
  onDayFilter,
  onRefresh,
  onAdd,
  onAddDoctor,
  onView,
  onEdit,
  onSchedule,
}: SchedulePanelProps) {
  const rows = useMemo(() => {
    const expanded: ScheduleRow[] = doctors.flatMap((doctor) =>
      workingDays(doctor).map((day) => ({ doctor, day })),
    );
    return expanded
      .filter(
        (row) =>
          (!doctorFilter || String(row.doctor.id) === doctorFilter) &&
          (!dayFilter || row.day === dayFilter),
      )
      .sort(
        (a, b) =>
          a.doctor.doctor_name.localeCompare(b.doctor.doctor_name) ||
          WEEKDAYS.indexOf(a.day) - WEEKDAYS.indexOf(b.day),
      );
  }, [doctors, doctorFilter, dayFilter]);

  const hasFilters = Boolean(doctorFilter || dayFilter);

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Doctor Schedules</h1>
          <p className="mt-0.5 text-xs text-muted">
            {doctors.length === 0
              ? "A schedule is created together with the doctor it belongs to."
              : `${rows.length} working-day entr${rows.length === 1 ? "y" : "ies"} across ${doctors.length} doctor${doctors.length === 1 ? "" : "s"}.`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={onRefresh} disabled={loading}>
            <IconRefresh className="h-4 w-4" />
            Refresh
          </Button>
          <Button onClick={onAdd}>
            <IconPlus className="h-4 w-4" />
            Add Schedule
          </Button>
        </div>
      </header>

      <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-xs">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-line px-4 py-3">
          <label className="flex items-center gap-2 text-xs font-medium text-muted">
            Doctor:
            <SelectInput
              value={doctorFilter}
              onChange={(event) => onDoctorFilter(event.target.value)}
              aria-label="Filter by doctor"
              className="w-44 py-1.5 text-xs"
            >
              <option value="">All Doctors</option>
              {doctors.map((doctor) => (
                <option key={doctor.id} value={String(doctor.id)}>
                  {doctor.doctor_name}
                </option>
              ))}
            </SelectInput>
          </label>

          <label className="flex items-center gap-2 text-xs font-medium text-muted">
            Day:
            <SelectInput
              value={dayFilter}
              onChange={(event) => onDayFilter(event.target.value)}
              aria-label="Filter by day"
              className="w-36 py-1.5 text-xs"
            >
              <option value="">All Days</option>
              {WEEKDAYS.map((day) => (
                <option key={day} value={day}>
                  {day}
                </option>
              ))}
            </SelectInput>
          </label>

          {hasFilters && (
            <button
              type="button"
              onClick={() => {
                onDoctorFilter("");
                onDayFilter("");
              }}
              className="text-xs font-medium text-brand-700 underline-offset-2 hover:underline dark:text-brand-300"
            >
              Clear filters
            </button>
          )}
        </div>

        {loading ? (
          <div className="px-4">
            <LoadingBlock label="Loading schedules..." />
          </div>
        ) : error ? (
          <div className="p-4">
            <Alert tone="danger">{error}</Alert>
          </div>
        ) : doctors.length === 0 ? (
          <div className="space-y-3 p-6">
            <EmptyState
              icon={<IconCalendarDays className="h-5 w-5" />}
              title="No schedules yet"
              description="A schedule is created with the doctor it belongs to. Add a doctor first, then adjust their days and hours here."
            />
            <div className="flex justify-center">
              <Button onClick={onAddDoctor}>
                <IconPlus className="h-4 w-4" />
                Add Doctor
              </Button>
            </div>
          </div>
        ) : rows.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="No schedules match these filters"
              description="Try another doctor or day, or clear the filters."
            />
          </div>
        ) : (


          <div className="table-responsive -mx-2 overflow-x-auto px-2">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-line text-2xs uppercase tracking-wide text-muted">
                  <th className="px-4 py-3 font-medium">Doctor</th>
                  <th className="px-4 py-3 font-medium">Day</th>
                  <th className="px-4 py-3 font-medium">Start</th>
                  <th className="px-4 py-3 font-medium">End</th>
                  <th className="px-4 py-3 font-medium">Slot</th>
                  <th className="px-4 py-3 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map(({ doctor, day }) => (
                  <tr key={`${doctor.id}-${day}`} className="transition hover:bg-surface-muted/60">
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => onView(doctor)}
                        className="flex max-w-full items-center gap-3 text-left touch-target"
                      >
                        <Avatar name={doctor.doctor_name} imageUrl={doctor.photo_url} className="h-8 w-8" />
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{doctor.doctor_name}</span>
                          <span className="block truncate text-xs text-muted">
                            {doctor.specialization || "General practice"}
                          </span>
                        </span>
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone="brand">{day}</Badge>
                    </td>
                    <td className="px-4 py-3">{formatTime(doctor.start_time)}</td>
                    <td className="px-4 py-3">{formatTime(doctor.end_time)}</td>
                    <td className="px-4 py-3">
                      <Badge tone="neutral">{doctor.slot_duration}m</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        <RowMenu
                          label={`Schedule actions for ${doctor.doctor_name} on ${day}`}
                          items={[
                            {
                              label: "Edit schedule",
                              icon: <IconCalendarDays className="h-3.5 w-3.5" />,
                              onSelect: () => onSchedule(doctor),
                            },
                            {
                              label: "Edit profile",
                              icon: <IconPencil className="h-3.5 w-3.5" />,
                              onSelect: () => onEdit(doctor),
                            },
                            {
                              label: "View profile",
                              icon: <IconEye className="h-3.5 w-3.5" />,
                              onSelect: () => onView(doctor),
                            },
                          ]}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}


/* ------------------------------------------------------------------ */
/* Row action menu + modal shell                                       */
/* ------------------------------------------------------------------ */

interface RowMenuItem {
  label: string;
  icon: ReactNode;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
}

/** ⋮ menu: opens on click, closes on outside click, Escape or selection. */
function RowMenu({ label, items }: { label: string; items: RowMenuItem[] }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <span ref={menuRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        className="rounded-lg p-2 text-muted transition hover:bg-surface-muted hover:text-foreground"
      >
        <IconDots className="h-4 w-4" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+4px)] z-20 w-44 rounded-lg border border-line bg-surface p-1 text-left shadow-lg"
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
                item.danger
                  ? "text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                  : "text-foreground hover:bg-surface-muted",
              )}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </span>
  );
}

function FormSection({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-3 rounded-lg border border-line bg-surface-muted/45 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-2xs font-semibold uppercase tracking-wide text-muted">{title}</p>
        {action}
      </div>
      {children}
    </section>
  );
}


/* ------------------------------------------------------------------ */
/* Doctor profile form — only open after "Add Doctor" / "Edit"         */
/* ------------------------------------------------------------------ */

function DoctorFormModal({
  mode,
  doctor,
  onClose,
  onCreate,
  onUpdate,
}: {
  mode: "create" | "edit";
  doctor: DoctorSchedule | null;
  onClose: () => void;
  onCreate: (payload: DoctorScheduleInput) => Promise<void>;
  onUpdate: (doctorId: number, payload: Partial<DoctorScheduleInput>) => Promise<void>;
}) {
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<DoctorFormState>(() => (doctor ? doctorFormFrom(doctor) : emptyDoctorForm()));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const doctorName = form.first_name || form.last_name ? `${form.first_name} ${form.last_name}`.trim() : "Doctor";

  function patch(next: Partial<DoctorFormState>) {
    setForm((previous) => ({ ...previous, ...next }));
  }

  function patchEducation(index: number, next: Partial<EducationForm>) {
    patch({
      educations: form.educations.map((education, currentIndex) =>
        currentIndex === index ? { ...education, ...next } : education,
      ),
    });
  }

  async function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);
    if (!file.type.startsWith("image/")) {
      setError("Choose an image file for the doctor photo.");
      return;
    }
    if (file.size > MAX_DOCTOR_PHOTO_BYTES) {
      setError("Choose a smaller doctor photo, under 5 MB.");
      return;
    }
    try {
      patch({ photo_url: await fileToDataUrl(file) });
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }

  function validate(): string | null {
    if (form.first_name.trim().length < 1) return "First name is required.";
    if (form.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email)) {
      return "Please enter a valid email address.";
    }
    if (form.gender && !GENDER_OPTIONS.includes(form.gender as (typeof GENDER_OPTIONS)[number])) {
      return "Please select a valid gender.";
    }
    if (form.experience_years && (Number(form.experience_years) < 0 || Number(form.experience_years) > 80)) {
      return "Experience must be between 0 and 80 years.";
    }
    for (const education of form.educations) {
      const compacted = compactEducation(education);
      if (!compacted) continue;
      if (!compacted.degree || !compacted.institution) return "Education entries need a degree and institution.";
      if (education.start_date && education.end_date && education.end_date < education.start_date) {
        return "Education end date must be after the start date.";
      }
    }
    return null;
  }

  async function handleSubmit() {
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }

    /* Left un-annotated so every field keeps its concrete type: the create
       path needs the required schedule fields, the update path a partial. */
    const base = {
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim() || null,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      date_of_birth: form.date_of_birth || null,
      gender: form.gender || null,
      address: form.address.trim() || null,
      photo_url: form.photo_url,
      license_number: form.license_number.trim() || null,
      specialization: form.specialization.trim() || null,
      qualification: form.qualification.trim() || null,
      experience_years: form.experience_years ? Number(form.experience_years) : null,
      bio: form.bio.trim() || null,
      consultation_fee: form.consultation_fee ? Number(form.consultation_fee) : null,
      consultation_duration: form.consultation_duration ? Number(form.consultation_duration) : null,
      is_verified: form.is_verified,
      educations: form.educations.map(compactEducation).filter((row): row is DoctorEducation => Boolean(row)),
    };

    setBusy(true);
    setError(null);
    try {
      if (mode === "create") {
        /* A new doctor starts with default hours; the schedule tab refines them. */
        await onCreate({
          ...base,
          start_time: toApiTime(DEFAULT_START_TIME) ?? DEFAULT_START_TIME,
          end_time: toApiTime(DEFAULT_END_TIME) ?? DEFAULT_END_TIME,
          slot_duration: Number(DEFAULT_SLOT_DURATION),
          days: [...WEEKDAYS],
        });
      } else if (doctor) {
        await onUpdate(doctor.id, base);
      }
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }


  return (
    <Modal
      title={mode === "create" ? "Add doctor" : `Edit ${doctor?.doctor_name ?? "doctor"}`}
      subtitle={
        mode === "create"
          ? "Profile, credentials and education — default hours are added automatically."
          : "Update the profile, credentials and education."
      }
      size="lg"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => void handleSubmit()} loading={busy}>
            {mode === "create" ? "Add doctor" : "Save changes"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <Alert tone="danger">{error}</Alert>}

        <FormSection title="Profile">
          <div className="flex items-center gap-3">
            <Avatar name={doctorName} imageUrl={form.photo_url} className="h-16 w-16 text-lg" />
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

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="First name" htmlFor="first_name" required>
              <TextInput
                id="first_name"
                autoFocus
                value={form.first_name}
                placeholder="Anjali"
                onChange={(event) => patch({ first_name: event.target.value })}
              />
            </Field>
            <Field label="Last name" htmlFor="last_name">
              <TextInput
                id="last_name"
                value={form.last_name}
                placeholder="Verma"
                onChange={(event) => patch({ last_name: event.target.value })}
              />
            </Field>
            <Field label="Email" hint="optional" htmlFor="email">
              <TextInput
                id="email"
                type="email"
                value={form.email}
                placeholder="doctor@clinic.com"
                onChange={(event) => patch({ email: event.target.value })}
              />
            </Field>
            <Field label="Phone" hint="optional" htmlFor="phone">
              <TextInput
                id="phone"
                type="tel"
                value={form.phone}
                placeholder="9800000000"
                onChange={(event) => patch({ phone: event.target.value })}
              />
            </Field>
            <Field label="Date of birth" hint="optional" htmlFor="date_of_birth">
              <TextInput
                id="date_of_birth"
                type="date"
                value={form.date_of_birth}
                onChange={(event) => patch({ date_of_birth: event.target.value })}
              />
            </Field>
            <Field label="Gender" hint="optional" htmlFor="gender">
              <SelectInput id="gender" value={form.gender} onChange={(event) => patch({ gender: event.target.value })}>
                <option value="">Select</option>
                {GENDER_OPTIONS.map((gender) => (
                  <option key={gender} value={gender}>
                    {gender}
                  </option>
                ))}
              </SelectInput>
            </Field>
          </div>

          <Field label="Address" hint="optional" htmlFor="address">
            <TextInput
              id="address"
              value={form.address}
              placeholder="123 Main St, City"
              onChange={(event) => patch({ address: event.target.value })}
            />
          </Field>
        </FormSection>


        <FormSection title="Credentials">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="License number" hint="optional" htmlFor="license_number">
              <TextInput
                id="license_number"
                value={form.license_number}
                placeholder="MED-12345"
                onChange={(event) => patch({ license_number: event.target.value })}
              />
            </Field>
            <Field label="Specialization" hint="optional" htmlFor="specialization">
              <TextInput
                id="specialization"
                value={form.specialization}
                placeholder="Cardiology"
                onChange={(event) => patch({ specialization: event.target.value })}
              />
            </Field>
            <Field label="Qualification" hint="summary" htmlFor="qualification">
              <TextInput
                id="qualification"
                value={form.qualification}
                placeholder="MD, DM Cardiology"
                onChange={(event) => patch({ qualification: event.target.value })}
              />
            </Field>
            <Field label="Experience" hint="years" htmlFor="experience_years">
              <TextInput
                id="experience_years"
                type="number"
                min={0}
                max={80}
                value={form.experience_years}
                placeholder="15"
                onChange={(event) => patch({ experience_years: event.target.value })}
              />
            </Field>
          </div>

          <Field label="Bio" hint="optional" htmlFor="bio">
            <TextArea
              id="bio"
              value={form.bio}
              placeholder="Brief professional biography..."
              onChange={(event) => patch({ bio: event.target.value })}
            />
          </Field>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Consultation fee" hint="optional" htmlFor="consultation_fee">
              <TextInput
                id="consultation_fee"
                type="number"
                min={0}
                step={0.01}
                value={form.consultation_fee}
                placeholder="1500"
                onChange={(event) => patch({ consultation_fee: event.target.value })}
              />
            </Field>
            <Field label="Duration" hint="minutes" htmlFor="consultation_duration">
              <TextInput
                id="consultation_duration"
                type="number"
                min={5}
                max={240}
                value={form.consultation_duration}
                placeholder="30"
                onChange={(event) => patch({ consultation_duration: event.target.value })}
              />
            </Field>
          </div>

          <label className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={form.is_verified}
              onChange={(event) => patch({ is_verified: event.target.checked })}
              className="rounded border-line"
            />
            Verified doctor
          </label>
        </FormSection>


        <FormSection
          title="Education"
          action={
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => patch({ educations: [...form.educations, emptyEducation()] })}
            >
              <IconPlus className="h-3.5 w-3.5" />
              Add
            </Button>
          }
        >
          {form.educations.map((education, index) => (
            <div key={index} className="rounded-lg border border-line bg-surface p-3">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-muted">Education {index + 1}</p>
                {form.educations.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => patch({ educations: form.educations.filter((_, i) => i !== index) })}
                  >
                    Remove
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Degree" htmlFor={`degree-${index}`}>
                  <TextInput
                    id={`degree-${index}`}
                    value={education.degree}
                    placeholder="MBBS"
                    onChange={(event) => patchEducation(index, { degree: event.target.value })}
                  />
                </Field>
                <Field label="Institution" htmlFor={`institution-${index}`}>
                  <TextInput
                    id={`institution-${index}`}
                    value={education.institution}
                    placeholder="Kathmandu University"
                    onChange={(event) => patchEducation(index, { institution: event.target.value })}
                  />
                </Field>
                <Field label="Field" hint="optional" htmlFor={`field-${index}`}>
                  <TextInput
                    id={`field-${index}`}
                    value={education.field_of_study}
                    placeholder="Internal Medicine"
                    onChange={(event) => patchEducation(index, { field_of_study: event.target.value })}
                  />
                </Field>
                <Field label="Completed" hint="optional" htmlFor={`end-${index}`}>
                  <TextInput
                    id={`end-${index}`}
                    type="date"
                    value={education.end_date}
                    onChange={(event) => patchEducation(index, { end_date: event.target.value })}
                  />
                </Field>
              </div>
              <Field label="Description" hint="optional" htmlFor={`description-${index}`} className="mt-3">
                <TextArea
                  id={`description-${index}`}
                  value={education.description}
                  onChange={(event) => patchEducation(index, { description: event.target.value })}
                />
              </Field>
            </div>
          ))}
        </FormSection>
      </div>
    </Modal>
  );
}


/* ------------------------------------------------------------------ */
/* Schedule form — only open after "Add Schedule" / "Edit schedule"    */
/* ------------------------------------------------------------------ */

function ScheduleFormModal({
  doctors,
  initialDoctorId,
  onClose,
  onSubmit,
}: {
  doctors: DoctorSchedule[];
  initialDoctorId: number | null;
  onClose: () => void;
  onSubmit: (doctorId: number, payload: Partial<DoctorScheduleInput>) => Promise<void>;
}) {
  const preset = doctors.find((doctor) => doctor.id === initialDoctorId) ?? doctors[0] ?? null;
  const [form, setForm] = useState<ScheduleFormState>(() => scheduleFormFrom(preset));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function patch(next: Partial<ScheduleFormState>) {
    setForm((previous) => ({ ...previous, ...next }));
  }

  /* Picking another doctor brings that doctor's current hours into the form. */
  function chooseDoctor(doctorId: string) {
    const next = doctors.find((doctor) => String(doctor.id) === doctorId) ?? null;
    setForm(scheduleFormFrom(next));
  }

  function toggleDay(day: string) {
    patch({
      days: form.days.includes(day) ? form.days.filter((value) => value !== day) : [...form.days, day],
    });
  }

  function validate(): string | null {
    if (!form.doctor_id) return "Choose a doctor.";
    if (form.days.length === 0) return "Pick at least one working day.";
    if (!form.start_time || !form.end_time) return "Start and end time are required.";
    if (form.end_time <= form.start_time) return "End time must be after start time.";
    if (form.break_start && form.break_end && form.break_end <= form.break_start) {
      return "Break end must be after break start.";
    }
    const duration = Number(form.slot_duration);
    if (!duration || duration < 5 || duration > 240) return "Slot length must be between 5 and 240 minutes.";
    return null;
  }

  async function handleSubmit() {
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }

    const payload: Partial<DoctorScheduleInput> = {
      days: form.days,
      start_time: toApiTime(form.start_time) ?? form.start_time,
      end_time: toApiTime(form.end_time) ?? form.end_time,
      break_start: toApiTime(form.break_start),
      break_end: toApiTime(form.break_end),
      leave_date: form.leave_date || null,
      slot_duration: Number(form.slot_duration),
    };

    setBusy(true);
    setError(null);
    try {
      await onSubmit(Number(form.doctor_id), payload);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  const selectedDoctor = doctors.find((doctor) => String(doctor.id) === form.doctor_id) ?? null;


  return (
    <Modal
      title={initialDoctorId === null ? "Add schedule" : "Edit schedule"}
      subtitle="Pick the doctor, the weekdays they work and the hours patients can book."
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => void handleSubmit()} loading={busy}>
            Save schedule
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <Alert tone="danger">{error}</Alert>}

        <Field label="Doctor" htmlFor="schedule-doctor" required>
          <SelectInput
            id="schedule-doctor"
            autoFocus
            value={form.doctor_id}
            onChange={(event) => chooseDoctor(event.target.value)}
          >
            <option value="">Select a doctor…</option>
            {doctors.map((doctor) => (
              <option key={doctor.id} value={String(doctor.id)}>
                {doctor.doctor_name}
              </option>
            ))}
          </SelectInput>
        </Field>

        <Field label="Working days" hint={`${form.days.length} selected`} required>
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map((day) => {
              const selected = form.days.includes(day);
              return (
                <button
                  key={day}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggleDay(day)}
                  className={cn(
                    "rounded-lg border px-2.5 py-1.5 text-xs font-medium transition",
                    selected
                      ? "border-brand-400 bg-brand-50 text-brand-700 dark:border-brand-700 dark:bg-brand-800/30 dark:text-brand-200"
                      : "border-line bg-surface text-muted hover:bg-surface-muted",
                  )}
                >
                  {day}
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex flex-wrap gap-3 text-2xs font-medium text-brand-700 dark:text-brand-300">
            <button
              type="button"
              onClick={() => patch({ days: [...WEEKDAYS] })}
              className="underline-offset-2 hover:underline"
            >
              Every day
            </button>
            <button
              type="button"
              onClick={() => patch({ days: WEEKDAYS.filter((day) => day !== "Saturday" && day !== "Sunday") })}
              className="underline-offset-2 hover:underline"
            >
              Weekdays
            </button>
            <button
              type="button"
              onClick={() => patch({ days: [] })}
              className="underline-offset-2 hover:underline"
            >
              Clear
            </button>
          </div>
        </Field>


        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Start time" htmlFor="schedule-start" required>
            <TextInput
              id="schedule-start"
              type="time"
              value={form.start_time}
              onChange={(event) => patch({ start_time: event.target.value })}
            />
          </Field>
          <Field label="End time" htmlFor="schedule-end" required>
            <TextInput
              id="schedule-end"
              type="time"
              value={form.end_time}
              onChange={(event) => patch({ end_time: event.target.value })}
            />
          </Field>
          <Field label="Break start" hint="optional" htmlFor="schedule-break-start">
            <TextInput
              id="schedule-break-start"
              type="time"
              value={form.break_start}
              onChange={(event) => patch({ break_start: event.target.value })}
            />
          </Field>
          <Field label="Break end" hint="optional" htmlFor="schedule-break-end">
            <TextInput
              id="schedule-break-end"
              type="time"
              value={form.break_end}
              onChange={(event) => patch({ break_end: event.target.value })}
            />
          </Field>
          <Field label="Leave date" hint="optional — a day the doctor is away" htmlFor="schedule-leave">
            <TextInput
              id="schedule-leave"
              type="date"
              value={form.leave_date}
              onChange={(event) => patch({ leave_date: event.target.value })}
            />
          </Field>
          <Field label="Slot length" hint="minutes" htmlFor="schedule-slot">
            <TextInput
              id="schedule-slot"
              type="number"
              min={5}
              max={240}
              value={form.slot_duration}
              onChange={(event) => patch({ slot_duration: event.target.value })}
            />
          </Field>
        </div>

        <p className="rounded-lg border border-line bg-surface-muted/45 px-3 py-2 text-xs leading-relaxed text-muted">
          {selectedDoctor ? selectedDoctor.doctor_name : "No doctor selected"} ·{" "}
          {form.days.length > 0 ? form.days.join(", ") : "no working days"} ·{" "}
          {formatTime(form.start_time)}–{formatTime(form.end_time)} · {form.slot_duration || "?"}m slots
        </p>
      </div>
    </Modal>
  );
}


/* ------------------------------------------------------------------ */
/* Read-only doctor profile                                            */
/* ------------------------------------------------------------------ */

function DoctorViewModal({
  doctor,
  busy,
  onClose,
  onEdit,
  onSchedule,
  onDelete,
}: {
  doctor: DoctorSchedule;
  busy: boolean;
  onClose: () => void;
  onEdit: () => void;
  onSchedule: () => void;
  onDelete: () => void;
}) {
  const educations = doctor.educations ?? [];
  const days = workingDays(doctor);

  return (
    <Modal
      title={doctor.doctor_name}
      subtitle="Doctor profile"
      size="lg"
      onClose={onClose}
      footer={
        <>
          <Button variant="danger" onClick={onDelete} disabled={busy}>
            <IconTrash className="h-4 w-4" />
            Delete
          </Button>
          <span className="flex-1" />
          <Button variant="secondary" onClick={onSchedule} disabled={busy}>
            <IconCalendarDays className="h-4 w-4" />
            Edit schedule
          </Button>
          <Button onClick={onEdit} disabled={busy}>
            <IconPencil className="h-4 w-4" />
            Edit profile
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <Avatar name={doctor.doctor_name} imageUrl={doctor.photo_url} className="h-20 w-20 text-xl" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-semibold tracking-tight">{doctor.doctor_name}</h3>
              {doctor.is_verified && <Badge tone="success">Verified</Badge>}
            </div>
            <p className="mt-1 text-sm text-muted">{doctor.specialization || "General practice"}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {doctor.qualification && <Badge tone="brand">{doctor.qualification}</Badge>}
              {doctor.experience_years !== null && doctor.experience_years !== undefined && (
                <Badge tone="neutral">{doctor.experience_years} years experience</Badge>
              )}
              {doctor.consultation_fee !== null && doctor.consultation_fee !== undefined && (
                <Badge tone="neutral">Fee {doctor.consultation_fee}</Badge>
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <InfoTile
            icon={<IconClock className="h-4 w-4" />}
            label="Working hours"
            value={`${formatTime(doctor.start_time)}–${formatTime(doctor.end_time)}`}
          />
          <InfoTile
            icon={<IconCalendarDays className="h-4 w-4" />}
            label="Working days"
            value={days.length === 7 ? "Every day" : `${days.length} days`}
          />
          <InfoTile
            icon={<IconStethoscope className="h-4 w-4" />}
            label="Visit length"
            value={`${doctor.slot_duration} min · ${scheduleSlots(doctor)} slots/day`}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Profile</h3>
            <p className="rounded-lg border border-line bg-surface-muted/45 p-3 text-sm leading-relaxed text-muted">
              {doctor.bio || "No biography has been added yet."}
            </p>
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <ContactLine icon={<IconMail className="h-4 w-4" />} value={doctor.email || "No email"} />
              <ContactLine icon={<IconPhone className="h-4 w-4" />} value={doctor.phone || "No phone"} />
              <ContactLine
                icon={<IconShieldCheck className="h-4 w-4" />}
                value={doctor.license_number || "No license"}
              />
              <ContactLine
                icon={<IconCalendarDays className="h-4 w-4" />}
                value={doctor.address || "No address"}
              />
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Schedule</h3>
            <div className="space-y-2 rounded-lg border border-line bg-surface-muted/45 p-3 text-sm">
              <ScheduleRow label="Days" value={days.length === 7 ? "Every day" : days.join(", ")} />
              <ScheduleRow
                label="Break"
                value={
                  doctor.break_start && doctor.break_end
                    ? `${formatTime(doctor.break_start)}–${formatTime(doctor.break_end)}`
                    : "None"
                }
              />
              <ScheduleRow label="Away" value={doctor.leave_date ? formatDate(doctor.leave_date) : "Available"} />
            </div>
          </section>
        </div>


        <section className="space-y-3">
          <h3 className="text-sm font-semibold">Education</h3>
          {educations.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2">
              {educations.map((education, index) => (
                <div
                  key={education.id ?? index}
                  className="rounded-lg border border-line bg-surface-muted/45 p-3"
                >
                  <p className="text-sm font-medium">{educationLabel(education)}</p>
                  <p className="mt-1 text-xs text-muted">{education.institution}</p>
                  {(education.start_date || education.end_date) && (
                    <p className="mt-2 text-xs text-muted">
                      {[education.start_date ? formatDate(education.start_date) : null, education.end_date ? formatDate(education.end_date) : null]
                        .filter(Boolean)
                        .join(" to ")}
                    </p>
                  )}
                  {education.description && (
                    <p className="mt-2 text-xs leading-relaxed text-muted">{education.description}</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-line px-3 py-4 text-sm text-muted">
              No education history has been added yet.
            </p>
          )}
        </section>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Small display helpers                                               */
/* ------------------------------------------------------------------ */

function InfoTile({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-surface-muted/45 p-3">
      <div className="flex items-center gap-2 text-muted">
        {icon}
        <p className="text-xs font-medium">{label}</p>
      </div>
      <p className="mt-2 text-sm font-semibold">{value}</p>
    </div>
  );
}

function ContactLine({ icon, value }: { icon: ReactNode; value: string }) {
  return (
    <p className="flex min-w-0 items-center gap-2 rounded-lg border border-line bg-surface-muted/45 px-3 py-2 text-muted">
      <span className="shrink-0">{icon}</span>
      <span className="truncate">{value}</span>
    </p>
  );
}

function ScheduleRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-muted">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

