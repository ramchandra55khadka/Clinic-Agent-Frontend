/**
 * TypeScript mirrors of the FastAPI backend Pydantic schemas
 * (`clinic-agent-backend/app/database/schema.py`).
 */

export type Intent = "doctor_bio" | "availability" | "booking" | "medical_web" | "fallback";

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
  id: number;
  doctor_name: string;
  specialization: string | null;
  photo_url: string | null;
  start_time: string;
  end_time: string;
  break_start: string | null;
  break_end: string | null;
  leave_date: string | null;
  slot_duration: number;
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

export interface AuthUser {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  profile_photo_url: string | null;
  role: string;
  is_active: boolean;
}

export interface ProfileUpdateInput {
  full_name?: string;
  phone?: string | null;
  profile_photo_url?: string | null;
}

/** The three account roles. Mirrors `app/core/roles.py` on the backend. */
export type UserRole = "patient" | "staff" | "admin";

/** `POST /api/auth/users` — an administrator onboarding clinic staff or another admin. */
export interface ManagedUserInput {
  full_name: string;
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

/** `POST /api/auth/register` (`phone` is optional on the backend). */
export interface RegisterInput {
  full_name: string;
  email: string;
  password: string;
  phone?: string | null;
}

/** Claims the backend puts inside its HS256 access token. */
export interface TokenClaims {
  sub?: string;
  email?: string;
  role?: string;
  iat?: number;
  exp?: number;
}
