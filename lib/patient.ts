import type { PatientDraft, PatientInput } from "./types";
import { isValidEmail, toApiTime } from "./utils";

/** Problems with the structured context that the agent needs for availability. */
export function contextProblems(doctorId: string, date: string): string[] {
  const problems: string[] = [];
  if (!doctorId) problems.push("Doctor");
  if (!date) problems.push("Date");
  return problems;
}

/** Problems with the patient form fields. */
export function patientProblems(patient: PatientDraft): string[] {
  const problems: string[] = [];

  if (patient.patient_name.trim().length < 2) problems.push("Patient name (min 2 characters)");

  const age = Number(patient.age);
  if (!patient.age.trim() || Number.isNaN(age) || age < 0 || age > 130) {
    problems.push("Age (0–130)");
  }

  if (!patient.sex) problems.push("Sex");
  if (!isValidEmail(patient.email)) problems.push("Valid email");
  if (patient.phone.trim().length < 7) problems.push("Phone (min 7 digits)");

  return problems;
}

/**
 * Builds the `AppointmentCreate` payload the backend expects, or `null` when the
 * context/patient state is incomplete.
 */
export function buildPatientInput(
  patient: PatientDraft,
  context: { doctorId: string; date: string; time: string },
): PatientInput | null {
  if (!context.doctorId || !context.date || !context.time) return null;
  if (patientProblems(patient).length > 0) return null;

  const apiTime = toApiTime(context.time);
  if (!apiTime) return null;

  return {
    doctor_id: Number(context.doctorId),
    patient_name: patient.patient_name.trim(),
    age: Number(patient.age),
    sex: patient.sex,
    email: patient.email.trim(),
    phone: patient.phone.trim(),
    date: context.date,
    time: apiTime,
  };
}
