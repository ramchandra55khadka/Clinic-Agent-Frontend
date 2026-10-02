/**
 * TypeScript mirrors of the FastAPI backend Pydantic schemas
 * (`clinic-agent-backend/app/database/schema.py`).
 */

export type Intent =
  | "doctor_bio"
  | "availability"
  | "booking"
  | "faq"
  | "medical_web"
  | "fallback";

export interface Chunk {
  content: string;
  source: string | null;
  page: number | null;
  chunk_id: number | null;
}

export interface Slot {
  time: string;
  available: boolean;
  reason: string | null;
}

export interface DoctorSchedule {
  /** The doctor's id (the bookable identity). */
  id: number;
  doctor_id: number;
  /** The primary key of the working-hours row. */
  schedule_id: number;
  doctor_name: string;
  specialization: string | null;
  photo_url: string | null;
  start_time: string;
  end_time: string;
  break_start: string | null;
  break_end: string | null;
  leave_date: string | null;
  slot_duration: number;
  /* Normalized `doctor` attributes (optional in the API). */
  license_number?: string | null;
  qualification?: string | null;
  experience_years?: number | null;
  bio?: string | null;
  consultation_fee?: number | null;
  consultation_duration?: number | null;
  is_verified?: boolean;
}

export interface DoctorScheduleInput {
  doctor_name: string;
  specialization?: string | null;
  photo_url?: string | null;
  start_time: string;
  end_time: string;
  break_start?: string | null;
  break_end?: string | null;
  leave_date?: string | null;
  slot_duration: number;
  license_number?: string | null;
  qualification?: string | null;
  experience_years?: number | null;
  bio?: string | null;
  consultation_fee?: number | null;
  consultation_duration?: number | null;
  is_verified?: boolean;
}

export interface PatientInput {
  doctor_id: number;
  patient_name: string;
  age: number;
  sex: string;
  email: string;
  phone: string;
  date: string;
  time: string;
}

export interface Appointment extends PatientInput {
  id: number;
  status: string;
  confirmation_email_status: string;
}

/**
 * `PUT /appointments/me/{id}` — self-service edit. The email is the ownership
 * anchor and cannot be changed here.
 */
export interface AppointmentUpdate {
  patient_name?: string;
  age?: number;
  sex?: string;
  phone?: string;
  date?: string;
  time?: string;
}

export interface BookedAppointment {
  id: number;
  patient_name: string;
  date: string;
  time: string;
  email_status?: string;
}

/** `ChatResponse.data` is an untyped dict on the backend; these are its known shapes. */
export interface ChatData {
  available?: boolean;
  reason?: string | null;
  slots?: Slot[];
  doctor_id?: number;
  date?: string;
  time?: string;
  next_step?: string;
  required?: string[];
  status?: string;
  appointment?: BookedAppointment;
  email_status?: string;
}

export interface ChatRequest {
  session_id?: string | null;
  message: string;
  doctor_id?: number | null;
  appointment_date?: string | null;
  appointment_time?: string | null;
  patient?: PatientInput | null;
}

export interface ChatResponse {
  session_id: string;
  intent: Intent;
  response: string;
  data: ChatData;
  chunks: Chunk[] | null;
}

export interface AvailabilityResponse {
  doctor_id: number;
  date: string;
  available: boolean;
  reason?: string | null;
  slots: Slot[];
}

export interface QueryRequest {
  query: string;
  top_k?: number;
  system_prompt?: string | null;
}

export interface QueryResponse {
  response: string;
  chunks: Chunk[] | null;
}

/** A rendered turn in the chat transcript. */
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  intent?: Intent;
  chunks?: Chunk[];
  data?: ChatData;
  error?: boolean;
}

/** Editable patient form state (all inputs are strings while typing). */
export interface PatientDraft {
  patient_name: string;
  age: string;
  sex: string;
  email: string;
  phone: string;
}

export const EMPTY_PATIENT: PatientDraft = {
  patient_name: "",
  age: "",
  sex: "",
  email: "",
  phone: "",
};

/* ------------------------------------------------------------------ */
/* Authentication (mirrors the backend auth schemas)                   */
/* ------------------------------------------------------------------ */

/** One of `Male` / `Female` / `Other` — mirrors the backend's `Gender` literal. */
export type Gender = "Male" | "Female" | "Other";

/** The gender choices offered in the profile form, in display order. */
export const GENDER_OPTIONS: readonly Gender[] = ["Male", "Female", "Other"];

/** True only for a value the backend will accept, so legacy/blank is excluded. */
export function isGender(value: string | null | undefined): value is Gender {
  return value === "Male" || value === "Female" || value === "Other";
}

export interface AuthUser {
  id: string;
  first_name: string;
  last_name: string | null;
  email: string;
  phone: string | null;
  date_of_birth: string | null;
  gender: Gender | null;
  address: string | null;
  photo_url: string | null;
  memory_enabled: boolean;
  role: string;
  is_active: boolean;
}

export interface ProfileUpdateInput {
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  date_of_birth?: string | null;
  gender?: Gender | null;
  address?: string | null;
  photo_url?: string | null;
  memory_enabled?: boolean;
}

export interface Memory {
  id: string;
  key: string;
  value: string;
  kind: string;
  content: string;
  source: string;
  confidence: number;
  created_at: string;
  updated_at: string;
  last_seen_at: string;
}

export interface MemoryListResponse {
  memories: Memory[];
}

/** Body of `PATCH /memories/{id}` — only the value is editable; the key is fixed. */
export interface MemoryUpdateInput {
  value: string;
}

/**
 * The personalization slots long-term memory may hold — mirrors `MEMORY_KEYS`
 * in `app/core/memory_keys.py`. One value per key per user, so saving a key
 * that already exists replaces it rather than adding a second row.
 */
export const MEMORY_KEYS = [
  "preferred_time",
  "preferred_doctor",
  "preferred_specialty",
  "language",
  "contact_preference",
  "books_for_family",
] as const;

export type MemoryKey = (typeof MEMORY_KEYS)[number];

/** Narrowing guard for a value that arrived from a `<select>` or JSON. */
export function isMemoryKey(value: string): value is MemoryKey {
  return (MEMORY_KEYS as readonly string[]).includes(value);
}

/** Body of `PUT /memories/{key}` — create (or replace) one personalization by hand. */
export interface MemoryCreateInput {
  key: MemoryKey;
  value: string;
}

export interface MemoryClearResponse {
  deleted: number;
}

/* ------------------------------------------------------------------ */
/* Conversations (chat memory)                                         */
/* ------------------------------------------------------------------ */

/** One stored turn, as replayed by `GET /conversations/{session_id}`. */
export interface ConversationTurn {
  id: number;
  role: "user" | "assistant";
  content: string;
  intent: Intent | null;
  created_at: string;
}

/** A chat thread in the sidebar. */
export interface ConversationSummary {
  session_id: string;
  /** Derived from the first patient message; `null` until the second turn. */
  title: string | null;
  message_count: number;
  created_at: string;
  updated_at: string;
}

export interface ConversationListResponse {
  conversations: ConversationSummary[];
}

export interface ConversationDetail {
  session_id: string;
  title: string | null;
  /** Rolling summary of turns older than the live window; may be `null`. */
  summary: string | null;
  message_count: number;
  messages: ConversationTurn[];
  /** True when older turns exist beyond this page. */
  has_more: boolean;
}

/** The three account roles. Mirrors `app/core/roles.py` on the backend. */
export type UserRole = "patient" | "staff" | "admin";

/** `POST /api/auth/users` — an administrator onboarding clinic staff or another admin. */
export interface ManagedUserInput {
  first_name: string;
  last_name?: string | null;
  email: string;
  password: string;
  phone?: string | null;
  role: Exclude<UserRole, "patient">;
}

/** `POST /api/auth/login` */
export interface LoginInput {
  email: string;
  password: string;
}

/** `POST /api/session/register` — the BFF splits this into account + profile calls. */
export interface RegisterInput {
  first_name: string;
  last_name?: string | null;
  email: string;
  password: string;
  phone?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  address?: string | null;
}

/** Claims the backend puts inside its HS256 access token. */
export interface TokenClaims {
  sub?: string;
  email?: string;
  role?: string;
  iat?: number;
  exp?: number;
}
