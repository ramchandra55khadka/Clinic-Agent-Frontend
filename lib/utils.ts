import { twMerge } from "tailwind-merge";

/** Join conditional class names, letting later Tailwind classes win. */
export function cn(...values: Array<string | false | null | undefined>): string {
  return twMerge(values.filter(Boolean).join(" "));
}

/** Join first/last name parts into a display name, skipping blanks. */
export function joinNames(first?: string | null, last?: string | null): string {
  return [first, last].filter(Boolean).join(" ");
}

/** Display name for anything carrying the backend's split `first_name`/`last_name`. */
export function displayName(name: {
  first_name?: string | null;
  last_name?: string | null;
}): string {
  return joinNames(name.first_name, name.last_name);
}

/** `09:00` -> `09:00:00` (the backend expects `HH:MM:SS` for `time.Time`). */
export function toApiTime(value: string): string | null {
  if (!value) return null;
  const [hours, minutes] = value.split(":");
  if (!hours || minutes === undefined) return null;
  return `${hours.padStart(2, "0")}:${minutes.padStart(2, "0")}:00`;
}

/** `09:00:00` -> `09:00` (what `<input type="time">` expects). */
export function fromApiTime(value?: string | null): string {
  if (!value) return "";
  return value.slice(0, 5);
}

/** `14:30:00` -> `2:30 PM` */
export function formatTime(value?: string | null): string {
  const short = fromApiTime(value);
  if (!short) return "";
  const [hours, minutes] = short.split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return short;
  const suffix = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 === 0 ? 12 : hours % 12;
  return `${displayHour}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

/** `2025-12-10` -> `Wed, Dec 10, 2025` */
export function formatDate(value?: string | null): string {
  if (!value) return "";
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Today as `YYYY-MM-DD` in the browser's local timezone. */
export function todayIso(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}

/** Weekday names the backend uses for schedule days (Sunday-first order). */
export const WEEKDAYS: readonly string[] = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const REASON_LABELS: Record<string, string> = {
  doctor_not_found: "Doctor not found",
  doctor_on_leave: "Doctor is on leave",
  not_working_day: "Doctor doesn't work that day",
  before_working_hours: "Before working hours",
  after_working_hours: "After working hours",
  during_break: "During the doctor's break",
  slot_booked: "Already booked",
};

/** Human-readable label for the backend's unavailability reason codes. */
export function reasonLabel(reason?: string | null): string {
  if (!reason) return "";
  return REASON_LABELS[reason] ?? reason.replace(/_/g, " ");
}

export function createId(prefix = "id"): string {
  const random =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}-${random}`;
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "Something went wrong. Please check that the backend is running.";
}
