"use client";

import { useEffect, useMemo, useState } from "react";

import { IconShieldCheck, IconUsers } from "@/components/icons";
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  LoadingBlock,
  PageHeader,
  SelectInput,
  StatCard,
  TextInput,
} from "@/components/ui";
import { useAuth } from "@/components/auth/auth-provider";
import { createUser, deleteUser, listUsers, setUserActive, updateUserRole } from "@/lib/api";
import { roleLabel } from "@/lib/roles";
import type { AuthUser, ManagedUserInput, UserRole } from "@/lib/types";
import { cn, displayName, errorMessage, isValidEmail } from "@/lib/utils";

const ROLE_OPTIONS: UserRole[] = ["patient", "staff", "admin"];

const ROLE_FILTERS = [
  { key: "all", label: "All" },
  { key: "patient", label: "Patients" },
  { key: "staff", label: "Clinic staff" },
  { key: "admin", label: "Administrators" },
] as const;

type RoleFilter = (typeof ROLE_FILTERS)[number]["key"];

const ROLE_TONES: Record<UserRole, "brand" | "success" | "neutral"> = {
  patient: "neutral",
  staff: "success",
  admin: "brand",
};

interface CreateForm {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  password: string;
  role: Exclude<UserRole, "patient">;
}

const EMPTY_FORM: CreateForm = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  password: "",
  role: "staff",
};

export function UsersView() {
  const { user: currentUser } = useAuth();

  const [users, setUsers] = useState<AuthUser[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [filter, setFilter] = useState<RoleFilter>("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [form, setForm] = useState<CreateForm>(EMPTY_FORM);
  const [formOpen, setFormOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    listUsers()
      .then((rows) => {
        if (!active) return;
        setUsers(rows);
        setLoadError(null);
      })
      .catch((cause) => {
        if (!active) return;
        setUsers([]);
        setLoadError(errorMessage(cause));
      });

    return () => {
      active = false;
    };
  }, [reloadKey]);

  const counts = useMemo(() => {
    const rows = users ?? [];
    return {
      all: rows.length,
      patient: rows.filter((row) => row.role === "patient").length,
      staff: rows.filter((row) => row.role === "staff").length,
      admin: rows.filter((row) => row.role === "admin").length,
      inactive: rows.filter((row) => !row.is_active).length,
    };
  }, [users]);

  const visible = useMemo(() => {
    const rows = users ?? [];
    const filtered = filter === "all" ? rows : rows.filter((row) => row.role === filter);
    return [...filtered].sort((left, right) => {
      if (left.is_active !== right.is_active) return left.is_active ? -1 : 1;
      return displayName(left).localeCompare(displayName(right));
    });
  }, [users, filter]);

  const activeAdmins = (users ?? []).filter(
    (row) => row.role === "admin" && row.is_active,
  ).length;

  function replaceUser(updated: AuthUser) {
    setUsers((rows) => (rows ?? []).map((row) => (row.id === updated.id ? updated : row)));
  }

  function refresh() {
    setUsers(null);
    setLoadError(null);
    setNotice(null);
    setActionError(null);
    setReloadKey((value) => value + 1);
  }

  /* ---------------------------- actions ---------------------------- */

  async function handleRoleChange(target: AuthUser, role: UserRole) {
    if (role === target.role) return;
    setBusyId(target.id);
    setActionError(null);
    setNotice(null);
    try {
      const updated = await updateUserRole(target.id, role);
      replaceUser(updated);
      setNotice(
        `${displayName(updated)} is now ${roleLabel(updated.role)}. Their other sessions were signed out.`,
      );
    } catch (cause) {
      setActionError(errorMessage(cause));
    } finally {
      setBusyId(null);
    }
  }

  async function handleToggleActive(target: AuthUser) {
    setBusyId(target.id);
    setActionError(null);
    setNotice(null);
    try {
      const updated = await setUserActive(target.id, !target.is_active);
      replaceUser(updated);
      setNotice(
        updated.is_active
          ? `${displayName(updated)} can sign in again.`
          : `${displayName(updated)} was deactivated and signed out everywhere.`,
      );
    } catch (cause) {
      setActionError(errorMessage(cause));
    } finally {
      setBusyId(null);
    }
  }

  async function handleDeleteAccount(target: AuthUser) {
    const confirmed = window.confirm(
      `Permanently delete ${displayName(target)}? This removes the account and cannot be undone.`,
    );
    if (!confirmed) return;

    setBusyId(target.id);
    setActionError(null);
    setNotice(null);
    try {
      await deleteUser(target.id);
      setUsers((rows) => (rows ?? []).filter((row) => row.id !== target.id));
      setNotice(`${displayName(target)} was permanently deleted.`);
    } catch (cause) {
      setActionError(errorMessage(cause));
    } finally {
      setBusyId(null);
    }
  }

  async function handleCreate() {
    const firstName = form.first_name.trim();
    const lastName = form.last_name.trim();
    const email = form.email.trim();

    if (!firstName) return setFormError("Please enter the person's first name.");
    if (!isValidEmail(email)) return setFormError("Please enter a valid work email address.");
    if (form.password.length < 8) {
      return setFormError("The password must be at least 8 characters long.");
    }

    const payload: ManagedUserInput = {
      first_name: firstName,
      email,
      password: form.password,
      role: form.role,
    };
    if (lastName) payload.last_name = lastName;
    const phone = form.phone.trim();
    if (phone) payload.phone = phone;

    setCreating(true);
    setFormError(null);
    setNotice(null);
    try {
      const created = await createUser(payload);
      setUsers((rows) => [...(rows ?? []), created]);
      setForm(EMPTY_FORM);
      setFormOpen(false);
      setNotice(
        `${displayName(created)} was added as ${roleLabel(created.role)}. Share the password with them securely.`,
      );
    } catch (cause) {
      setFormError(errorMessage(cause));
    } finally {
      setCreating(false);
    }
  }

  const filterCounts: Record<RoleFilter, number> = {
    all: counts.all,
    patient: counts.patient,
    staff: counts.staff,
    admin: counts.admin,
  };

  return (
    <main className="page-shell">
      <PageHeader
        title="Team & accounts"
        description="Who works at the clinic and what each person can do. Doctors and their availability are maintained by clinic staff; accounts are managed here."
        actions={
          <>
            <Button variant="ghost" size="sm" onClick={refresh} disabled={users === null}>
              Refresh
            </Button>
            <Button size="sm" onClick={() => setFormOpen((open) => !open)}>
              {formOpen ? "Close" : "Add a person"}
            </Button>
          </>
        }
      />

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Clinic staff"
          value={users === null ? "—" : counts.staff}
          tone="success"
        />
        <StatCard
          label="Administrators"
          value={users === null ? "—" : counts.admin}
          tone="brand"
        />
        <StatCard
          label="Patients"
          value={users === null ? "—" : counts.patient}
        />
      </div>

      <Alert tone="info" className="mt-5">
        <span className="font-medium">Roles.</span> Patients book and manage their own
        visits. Clinic staff maintain doctors, working hours, breaks and time off, and can
        see the clinic-wide appointment list. Administrators can do everything staff can,
        plus manage accounts —{" "}
        {activeAdmins === 1
          ? "the last remaining administrator cannot be demoted or deactivated."
          : "at least one administrator always has to remain."}
      </Alert>

      {loadError && (
        <Alert tone="danger" className="mt-5">
          {loadError}
          <button
            type="button"
            onClick={refresh}
            className="ml-1 font-medium underline underline-offset-2"
          >
            Try again
          </button>
        </Alert>
      )}

      {notice && (
        <Alert tone="success" className="mt-5">
          {notice}
        </Alert>
      )}

      {actionError && (
        <Alert tone="danger" className="mt-5">
          {actionError}
        </Alert>
      )}

      {formOpen && (
        <Card
          className="mt-5"
          title="Add a person"
          subtitle="Create a clinic account. New people receive this password and can change it after signing in."
        >
          {formError && (
            <Alert tone="danger" className="mb-3">
              {formError}
            </Alert>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="First name" htmlFor="new-name">
              <TextInput
                id="new-name"
                autoComplete="off"
                value={form.first_name}
                onChange={(event) => setForm({ ...form, first_name: event.target.value })}
              />
            </Field>
            <Field label="Last name" hint="optional" htmlFor="new-last-name">
              <TextInput
                id="new-last-name"
                autoComplete="off"
                value={form.last_name}
                onChange={(event) => setForm({ ...form, last_name: event.target.value })}
              />
            </Field>
            <Field label="Work email" htmlFor="new-email">
              <TextInput
                id="new-email"
                type="email"
                autoComplete="off"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
              />
            </Field>
            <Field label="Phone" hint="optional" htmlFor="new-phone">
              <TextInput
                id="new-phone"
                inputMode="tel"
                value={form.phone}
                onChange={(event) => setForm({ ...form, phone: event.target.value })}
              />
            </Field>
            <Field label="Role" htmlFor="new-role">
              <SelectInput
                id="new-role"
                value={form.role}
                onChange={(event) =>
                  setForm({ ...form, role: event.target.value as CreateForm["role"] })
                }
              >
                <option value="staff">Clinic staff</option>
                <option value="admin">Administrator</option>
              </SelectInput>
            </Field>
            <Field
              label="Temporary password"
              hint="at least 8 characters"
              htmlFor="new-password"
              className="sm:col-span-2"
            >
              <TextInput
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
              />
            </Field>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" loading={creating} onClick={() => void handleCreate()}>
              Create account
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={creating}
              onClick={() => {
                setFormOpen(false);
                setForm(EMPTY_FORM);
                setFormError(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </Card>
      )}

      <Card
        className="mt-5"
        title="People"
        subtitle={
          users === null
            ? "Loading…"
            : `${visible.length} of ${counts.all} account${counts.all === 1 ? "" : "s"}${
                counts.inactive > 0 ? ` · ${counts.inactive} deactivated` : ""
              }`
        }
        action={
          <div className="flex flex-wrap gap-1.5">
            {ROLE_FILTERS.map((option) => (
              <button
                key={option.key}
                type="button"
                aria-pressed={filter === option.key}
                onClick={() => setFilter(option.key)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                  filter === option.key
                    ? "border-brand-300 bg-brand-50 text-brand-700 dark:border-brand-700 dark:bg-brand-800/30 dark:text-brand-200"
                    : "border-line bg-surface text-muted hover:bg-surface-muted hover:text-foreground",
                )}
              >
                {option.label}
                <span className="ml-1 text-muted">{filterCounts[option.key]}</span>
              </button>
            ))}
          </div>
        }
      >
        {users === null && <LoadingBlock label="Loading accounts…" />}

        {users !== null && visible.length === 0 && (
          <EmptyState
            icon={<IconUsers className="h-5 w-5" />}
            title="Nobody matches this filter"
            description="Try a different role, or add a colleague with “Add a person”."
          />
        )}

        {visible.length > 0 && (
          <ul className="divide-y divide-line">
            {visible.map((account) => {
              const isSelf = account.id === currentUser?.id;
              const busy = busyId === account.id;
              return (
                <li
                  key={account.id}
                  className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 lg:flex-row lg:items-center lg:justify-between"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={displayName(account)} />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-medium">{displayName(account)}</span>
                        <Badge tone={ROLE_TONES[account.role as UserRole] ?? "neutral"}>
                          {roleLabel(account.role)}
                        </Badge>
                        {isSelf && <Badge tone="neutral">You</Badge>}
                        {!account.is_active && <Badge tone="danger">Deactivated</Badge>}
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted">
                        {account.email}
                        {account.phone ? ` · ${account.phone}` : ""}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <SelectInput
                      aria-label={`Role for ${displayName(account)}`}
                      value={account.role}
                      disabled={busy}
                      className="w-40"
                      onChange={(event) =>
                        void handleRoleChange(account, event.target.value as UserRole)
                      }
                    >
                      {ROLE_OPTIONS.map((role) => (
                        <option key={role} value={role}>
                          {roleLabel(role)}
                        </option>
                      ))}
                    </SelectInput>

                    <Button
                      variant={account.is_active ? "danger" : "secondary"}
                      size="sm"
                      loading={busy}
                      disabled={isSelf}
                      title={isSelf ? "You cannot deactivate your own account" : undefined}
                      onClick={() => void handleToggleActive(account)}
                    >
                      {account.is_active ? "Deactivate" : "Reactivate"}
                    </Button>

                    <Button
                      variant="danger"
                      size="sm"
                      loading={busy}
                      disabled={isSelf}
                      title={isSelf ? "You cannot delete your own account" : undefined}
                      onClick={() => void handleDeleteAccount(account)}
                    >
                      Delete
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card className="mt-5" title="How roles differ">
        <dl className="grid gap-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="flex items-center gap-1.5 font-medium">
              <IconUsers className="h-4 w-4 text-muted" />
              Patient
            </dt>
            <dd className="mt-1 text-xs text-muted">
              Books visits, chats with the assistant, and manages their own appointments.
              Created by self-registration.
            </dd>
          </div>
          <div>
            <dt className="flex items-center gap-1.5 font-medium">
              <IconShieldCheck className="h-4 w-4 text-muted" />
              Clinic staff
            </dt>
            <dd className="mt-1 text-xs text-muted">
              Adds doctors and maintains their availability — working hours, lunch break,
              time off and visit length — and sees the clinic-wide appointment list.
            </dd>
          </div>
          <div>
            <dt className="flex items-center gap-1.5 font-medium">
              <IconShieldCheck className="h-4 w-4 text-muted" />
              Administrator
            </dt>
            <dd className="mt-1 text-xs text-muted">
              Everything clinic staff can do, plus managing accounts and roles on this
              page. At least one administrator always remains.
            </dd>
          </div>
        </dl>
      </Card>
    </main>
  );
}