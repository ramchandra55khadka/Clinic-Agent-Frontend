"use client";

import { useCallback, useEffect, useState } from "react";

import { listSchedules } from "./api";
import type { DoctorSchedule } from "./types";
import { errorMessage } from "./utils";

interface UseDoctorsResult {
  doctors: DoctorSchedule[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

/** Loads every doctor schedule so pickers can show `Dr. Name (#id)`. */
export function useDoctors(): UseDoctorsResult {
  const [doctors, setDoctors] = useState<DoctorSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* Initial load: state is only updated from async callbacks. */
  useEffect(() => {
    let active = true;

    listSchedules()
      .then((schedules) => {
        if (!active) return;
        setDoctors(schedules);
        setError(null);
        setLoading(false);
      })
      .catch((cause) => {
        if (!active) return;
        setError(errorMessage(cause));
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  /* Manual refresh, used by buttons after create/update/delete. */
  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const schedules = await listSchedules();
      setDoctors(schedules);
      setError(null);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, []);

  return { doctors, loading, error, reload };
}

export function doctorLabel(doctor: DoctorSchedule): string {
  const specialization = doctor.specialization ? ` · ${doctor.specialization}` : "";
  return `${doctor.doctor_name} (#${doctor.id})${specialization}`;
}
