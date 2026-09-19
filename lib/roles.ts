/**
 * Role helpers — mirrors `clinic-agent-backend/app/core/roles.py`.
 *
 * Three roles exist: `patient` (a normal user), `staff` (clinic front desk, who
 * maintain doctors and their availability) and `admin` (everything staff can do,
 * plus account management). Admin is a superset of staff.
 *
 * These helpers only shape the UI. Every API call is authorised by the backend,
 * which reads the role from the database — so a stale client value can never
 * grant access.
 */

import type { AuthUser, UserRole } from "./types";

export const PATIENT_ROLE: UserRole = "patient";
export const STAFF_ROLE: UserRole = "staff";
export const ADMIN_ROLE: UserRole = "admin";

/** Every role, for navigation visible to all signed-in users. */
export const ALL_ROLES: readonly UserRole[] = [PATIENT_ROLE, STAFF_ROLE, ADMIN_ROLE];

/** Roles that maintain doctors and their availability. */
export const CLINIC_STAFF_ROLES: readonly UserRole[] = [STAFF_ROLE, ADMIN_ROLE];

/** Roles that manage accounts. */
export const ADMIN_ROLES: readonly UserRole[] = [ADMIN_ROLE];

export function isAdmin(user: AuthUser | null | undefined): boolean {
  return user?.role === ADMIN_ROLE;
}

/** True for staff *and* admins, matching the backend's `require_staff`. */
export function isStaff(user: AuthUser | null | undefined): boolean {
  return user?.role === STAFF_ROLE || user?.role === ADMIN_ROLE;
}

export function canManageDoctors(user: AuthUser | null | undefined): boolean {
  return isStaff(user);
}

export function canManageUsers(user: AuthUser | null | undefined): boolean {
  return isAdmin(user);
}

export function hasRole(role: string | null | undefined, allowed: readonly UserRole[]): boolean {
  return allowed.includes((role ?? "") as UserRole);
}

const ROLE_LABELS: Record<UserRole, string> = {
  patient: "Patient",
  staff: "Clinic staff",
  admin: "Administrator",
};

/** Human-readable role name for the account menu. */
export function roleLabel(role: string | null | undefined): string {
  if (!role) return "Unknown";
  return ROLE_LABELS[role as UserRole] ?? role;
}