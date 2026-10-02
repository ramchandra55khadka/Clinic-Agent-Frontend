import type {
  Appointment,
  AppointmentUpdate,
  AuthUser,
  AvailabilityResponse,
  ChatRequest,
  ChatResponse,
  ConversationDetail,
  ConversationListResponse,
  DoctorSchedule,
  DoctorScheduleInput,
  ManagedUserInput,
  Memory,
  MemoryClearResponse,
  MemoryCreateInput,
  MemoryListResponse,
  MemoryUpdateInput,
  PatientInput,
  ProfileUpdateInput,
  QueryRequest,
  QueryResponse,
  Slot,
  UserRole,
} from "./types";
import { notifySessionExpired } from "./session";

/**
 * All requests go to a same-origin path that the catch-all proxy route
 * (`app/api/clinic/[[...path]]/route.ts`) forwards to the FastAPI backend, so
 * no CORS configuration is required on the API side.
 *
 * Authentication is transparent here: the proxy attaches the bearer token from
 * the httpOnly session cookie, so this module never handles credentials.
 */
export const API_BASE = "/api/clinic";

/**
 * The backend mounts its routers under the `/api` prefix. The proxy preserves
 * the path, so `/api/clinic/api/auth/login` reaches `/api/auth/login`.
 */
const AUTH_ROOT = "/api/auth";

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function detailOf(body: unknown): string | null {
  if (!body || typeof body !== "object" || !("detail" in body)) return null;
  const detail = (body as { detail: unknown }).detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (item && typeof item === "object" && "msg" in item) {
          const loc = "loc" in item && Array.isArray(item.loc) ? item.loc.join(".") : "";
          const msg = String((item as { msg: unknown }).msg);
          return loc ? `${loc}: ${msg}` : msg;
        }
        return JSON.stringify(item);
      })
      .join("; ");
  }
  if (detail) return JSON.stringify(detail);
  return null;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });
  } catch {
    throw new ApiError(
      "Cannot reach the clinic backend. Start it with `uv run uvicorn app.main:app --reload`.",
      0,
    );
  }

  const raw = await response.text();
  let body: unknown = null;
  if (raw) {
    try {
      body = JSON.parse(raw);
    } catch {
      body = raw;
    }
  }

  if (!response.ok) {
    // A rejected token means the session cookie is no longer accepted; the auth
    // provider listens for this event and returns the UI to `/login`.
    if (response.status === 401) notifySessionExpired();
    throw new ApiError(
      detailOf(body) ?? `Request failed with status ${response.status}`,
      response.status,
    );
  }

  return body as T;
}

function post<T>(path: string, payload: unknown): Promise<T> {
  return request<T>(path, { method: "POST", body: JSON.stringify(payload) });
}

/* ------------------------------------------------------------------ */
/* Health                                                              */
/* ------------------------------------------------------------------ */

export interface HealthResponse {
  message: string;
  status: string;
}

export function getHealth(): Promise<HealthResponse> {
  return request<HealthResponse>("/");
}

/* ------------------------------------------------------------------ */
/* Agents                                                              */
/* ------------------------------------------------------------------ */

/** `POST /chat` — the LangGraph clinic workflow (doctor bio / availability / booking). */
export function chat(payload: ChatRequest): Promise<ChatResponse> {
  return post<ChatResponse>("/chat", payload);
}

/** `POST /rag` — direct doctor-info RAG query. */
export function queryDoctorInfo(payload: QueryRequest): Promise<QueryResponse> {
  return post<QueryResponse>("/rag", payload);
}

/* ------------------------------------------------------------------ */
/* Doctor schedules                                                    */
/* ------------------------------------------------------------------ */

export function listSchedules(): Promise<DoctorSchedule[]> {
  return request<DoctorSchedule[]>("/doctor-schedule/");
}

export function getSchedule(doctorId: number): Promise<DoctorSchedule> {
  return request<DoctorSchedule>(`/doctor-schedule/${doctorId}`);
}

export function createSchedule(input: DoctorScheduleInput): Promise<DoctorSchedule> {
  return post<DoctorSchedule>("/doctor-schedule/", input);
}

export function updateSchedule(
  doctorId: number,
  input: Partial<DoctorScheduleInput>,
): Promise<DoctorSchedule> {
  return request<DoctorSchedule>(`/doctor-schedule/${doctorId}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function deleteSchedule(doctorId: number): Promise<{ message: string }> {
  return request<{ message: string }>(`/doctor-schedule/${doctorId}`, { method: "DELETE" });
}

/* ------------------------------------------------------------------ */
/* Appointments                                                        */
/* ------------------------------------------------------------------ */

export function createAppointment(patient: PatientInput): Promise<Appointment> {
  return post<Appointment>("/appointments/", patient);
}

export function listAppointments(doctorId: number): Promise<Appointment[]> {
  return request<Appointment[]>(`/appointments/${doctorId}`);
}

/* ------------------------------------------------------------------ */
/* My appointments (self-service)                                      */
/* ------------------------------------------------------------------ */

/** `GET /appointments/me` — the signed-in patient's own bookings. */
export function listMyAppointments(): Promise<Appointment[]> {
  return request<Appointment[]>("/appointments/me");
}

/** `GET /appointments/me/{id}` — detail; 404 unless the booking is the caller's. */
export function getMyAppointment(appointmentId: number): Promise<Appointment> {
  return request<Appointment>(`/appointments/me/${appointmentId}`);
}

/** `PUT /appointments/me/{id}` — edit details or reschedule. */
export function updateMyAppointment(
  appointmentId: number,
  changes: AppointmentUpdate,
): Promise<Appointment> {
  return request<Appointment>(`/appointments/me/${appointmentId}`, {
    method: "PUT",
    body: JSON.stringify(changes),
  });
}

/** `POST /appointments/me/{id}/cancel` — cancels and frees the slot. */
export function cancelMyAppointment(appointmentId: number): Promise<Appointment> {
  return request<Appointment>(`/appointments/me/${appointmentId}/cancel`, { method: "POST" });
}

/* ------------------------------------------------------------------ */
/* Availability                                                        */
/* ------------------------------------------------------------------ */

export function checkAvailability(payload: {
  doctor_id: number;
  date: string;
  time?: string | null;
}): Promise<AvailabilityResponse> {
  return post<AvailabilityResponse>("/availability/", payload);
}

export function listSlots(
  doctorId: number,
  date: string,
  excludeAppointmentId?: number,
): Promise<AvailabilityResponse> {
  // `exclude_appointment_id` shows a patient their own slot as free while rescheduling.
  const query = excludeAppointmentId ? `?exclude_appointment_id=${excludeAppointmentId}` : "";
  return request<AvailabilityResponse>(`/availability/${doctorId}/${date}${query}`);
}

/** `GET /api/auth/me` — profile of the signed-in user (401 when signed out). */
export function getMe(): Promise<AuthUser> {
  return request<AuthUser>(`${AUTH_ROOT}/me`);
}

/** `PATCH /api/auth/me` — update the signed-in user's profile. */
export function updateMe(input: ProfileUpdateInput): Promise<AuthUser> {
  return request<AuthUser>(`${AUTH_ROOT}/me`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

/* ------------------------------------------------------------------ */
/* Conversations (chat memory)                                         */
/* ------------------------------------------------------------------ */

/** `GET /conversations/` — the signed-in patient's threads, newest first. */
export function listConversations(): Promise<ConversationListResponse> {
  return request<ConversationListResponse>("/conversations/");
}

/**
 * `GET /conversations/{session_id}` — replay one thread so the UI can restore it
 * after a refresh or on a different device. Returns the newest page of turns;
 * pass `before` (a message id) to walk backwards through older ones.
 */
export function getConversation(
  sessionId: string,
  options?: { limit?: number; before?: number },
): Promise<ConversationDetail> {
  const params = new URLSearchParams();
  if (options?.limit) params.set("limit", String(options.limit));
  if (options?.before) params.set("before", String(options.before));
  const query = params.toString();
  return request<ConversationDetail>(
    `/conversations/${encodeURIComponent(sessionId)}${query ? `?${query}` : ""}`,
  );
}

/** `DELETE /conversations/{session_id}` — remove a thread and its turns. */
export function deleteConversation(sessionId: string): Promise<{ message: string }> {
  return request<{ message: string }>(`/conversations/${encodeURIComponent(sessionId)}`, {
    method: "DELETE",
  });
}

/* ------------------------------------------------------------------ */
/* Long-term memories                                                  */
/* ------------------------------------------------------------------ */

export function listMemories(): Promise<MemoryListResponse> {
  return request<MemoryListResponse>("/memories/");
}

/** `PATCH /memories/{id}` — rewrite the value of one saved personalization. */
export function updateMemory(memoryId: string, input: MemoryUpdateInput): Promise<Memory> {
  return request<Memory>(`/memories/${encodeURIComponent(memoryId)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

/**
 * `PUT /memories/{key}` — save a personalization the user chose themselves.
 *
 * The key is the slot, not a new row each time: reusing one overwrites its
 * value (200) instead of creating a duplicate, while a fresh slot is created
 * (201).
 */
export function createMemory(input: MemoryCreateInput): Promise<Memory> {
  return request<Memory>(`/memories/${encodeURIComponent(input.key)}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function deleteMemory(memoryId: string): Promise<{ message: string }> {
  return request<{ message: string }>(`/memories/${memoryId}`, { method: "DELETE" });
}

export function clearMemories(): Promise<MemoryClearResponse> {
  return request<MemoryClearResponse>("/memories/", { method: "DELETE" });
}

/* ------------------------------------------------------------------ */
/* Account management (admin only — the backend enforces this)         */
/* ------------------------------------------------------------------ */

/** `GET /api/auth/users` — every account, optionally filtered by role. */
export function listUsers(role?: UserRole): Promise<AuthUser[]> {
  return request<AuthUser[]>(`${AUTH_ROOT}/users${role ? `?role=${role}` : ""}`);
}

/** `POST /api/auth/users` — create a clinic staff or admin account. */
export function createUser(input: ManagedUserInput): Promise<AuthUser> {
  return request<AuthUser>(`${AUTH_ROOT}/users`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** `PATCH /api/auth/users/{id}/role` — change a role; sessions are revoked. */
export function updateUserRole(userId: string, role: UserRole): Promise<AuthUser> {
  return request<AuthUser>(`${AUTH_ROOT}/users/${userId}/role`, {
    method: "PATCH",
    body: JSON.stringify({ role }),
  });
}

/** `PATCH /api/auth/users/{id}/active` — enable or disable an account. */
export function setUserActive(userId: string, isActive: boolean): Promise<AuthUser> {
  return request<AuthUser>(`${AUTH_ROOT}/users/${userId}/active`, {
    method: "PATCH",
    body: JSON.stringify({ is_active: isActive }),
  });
}

/** `DELETE /api/auth/users/{id}` — permanently delete a team account. */
export function deleteUser(userId: string): Promise<{ message: string }> {
  return request<{ message: string }>(`${AUTH_ROOT}/users/${userId}`, {
    method: "DELETE",
  });
}

/* ------------------------------------------------------------------ */
/* MCP tools (mirrors of the backend tool endpoints)                   */
/* ------------------------------------------------------------------ */

export function mcpCheckAvailability(payload: {
  doctor_id: number;
  date: string;
  time?: string | null;
}): Promise<{ available: boolean; reason: string | null; slots: Slot[] }> {
  return post("/mcp/check-availability", payload);
}

export function mcpBookAppointment(
  appointment: PatientInput,
): Promise<{ status: string; appointment?: unknown }> {
  return post("/mcp/book-appointment", { appointment });
}

export const api = {
  getHealth,
  getMe,
  updateMe,
  listMemories,
  updateMemory,
  createMemory,
  deleteMemory,
  clearMemories,
  listConversations,
  getConversation,
  deleteConversation,
  chat,
  queryDoctorInfo,
  listSchedules,
  getSchedule,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  createAppointment,
  listAppointments,
  listMyAppointments,
  getMyAppointment,
  updateMyAppointment,
  cancelMyAppointment,
  checkAvailability,
  listSlots,
  listUsers,
  createUser,
  updateUserRole,
  setUserActive,
  deleteUser,
  mcpCheckAvailability,
  mcpBookAppointment,
};