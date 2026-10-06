"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";

import { useAuth } from "@/components/auth/auth-provider";
import { Alert, Avatar, Badge, Button, Card, EmptyState, Field, LoadingBlock, SelectInput, TextInput } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { clearMemories, createMemory, deleteMemory, listMemories, updateMe, updateMemory } from "@/lib/api";
import { GENDER_OPTIONS, isGender, isMemoryKey, type Memory, MEMORY_KEYS, type MemoryKey } from "@/lib/types";
import { displayName } from "@/lib/utils";

const MAX_PHOTO_BYTES = 5_000_000;

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read the selected photo."));
    reader.readAsDataURL(file);
  });
}

function formatMemoryDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function memoryLabel(key: string) {
  return key
    .split("_")
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

export function ProfileView() {
  const { user, setCurrentUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [firstName, setFirstName] = useState(user?.first_name ?? "");
  const [lastName, setLastName] = useState(user?.last_name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [dateOfBirth, setDateOfBirth] = useState(user?.date_of_birth ?? "");
  const [gender, setGender] = useState<string>(isGender(user?.gender) ? user.gender : "");
  const [address, setAddress] = useState(user?.address ?? "");
  const [photo, setPhoto] = useState<string | null>(user?.photo_url ?? null);
  const [memoryEnabled, setMemoryEnabled] = useState(user?.memory_enabled ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loadingMemories, setLoadingMemories] = useState(true);
  const [memoryError, setMemoryError] = useState<string | null>(null);
  const [memoryBusyId, setMemoryBusyId] = useState<string | null>(null);
  const [clearingMemories, setClearingMemories] = useState(false);
  /** Id of the personalization currently open for editing, if any. */
  const [editingMemoryId, setEditingMemoryId] = useState<string | null>(null);
  /** Live text of that edit field, committed to the API on submit. */
  const [memoryDraft, setMemoryDraft] = useState("");
  /** Whether the "add a personalization" form is open. */
  const [addingMemory, setAddingMemory] = useState(false);
  /** Which slot the add form will write to — one value per key. */
  const [newMemoryKey, setNewMemoryKey] = useState<MemoryKey>(MEMORY_KEYS[0]);
  /** Live text of that new value, committed to the API on submit. */
  const [newMemoryValue, setNewMemoryValue] = useState("");
  const [savingNewMemory, setSavingNewMemory] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadMemories() {
      setLoadingMemories(true);
      setMemoryError(null);
      try {
        const result = await listMemories();
        if (active) setMemories(result.memories);
      } catch (err) {
        if (active) {
          setMemoryError(err instanceof ApiError ? err.message : "Could not load memories.");
        }
      } finally {
        if (active) setLoadingMemories(false);
      }
    }

    if (user) void loadMemories();
    return () => {
      active = false;
    };
  }, [user]);

  async function handlePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);
    setSuccess(false);

    if (!file.type.startsWith("image/")) {
      setError("Choose an image file.");
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setError("Choose a smaller image, under 5 MB.");
      return;
    }

    try {
      setPhoto(await fileToDataUrl(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read the selected photo.");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const updated = await updateMe({
        first_name: firstName.trim(),
        last_name: lastName.trim() || null,
        phone: phone.trim() || null,
        date_of_birth: dateOfBirth || null,
        gender: isGender(gender) ? gender : null,
        address: address.trim() || null,
        photo_url: photo,
        memory_enabled: memoryEnabled,
      });
      setCurrentUser(updated);
      setFirstName(updated.first_name);
      setLastName(updated.last_name ?? "");
      setPhone(updated.phone ?? "");
      setDateOfBirth(updated.date_of_birth ?? "");
      setGender(isGender(updated.gender) ? updated.gender : "");
      setAddress(updated.address ?? "");
      setPhoto(updated.photo_url);
      setMemoryEnabled(updated.memory_enabled);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update your profile.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteMemory(memoryId: string) {
    setMemoryBusyId(memoryId);
    setMemoryError(null);
    try {
      await deleteMemory(memoryId);
      setMemories((current) => current.filter((memory) => memory.id !== memoryId));
    } catch (err) {
      setMemoryError(err instanceof ApiError ? err.message : "Could not delete that memory.");
    } finally {
      setMemoryBusyId(null);
    }
  }

  function startEditingMemory(memory: Memory) {
    setEditingMemoryId(memory.id);
    setMemoryDraft(memory.value);
    setMemoryError(null);
  }

  function cancelEditingMemory() {
    setEditingMemoryId(null);
    setMemoryDraft("");
  }

  async function handleUpdateMemory(event: FormEvent<HTMLFormElement>, memoryId: string) {
    event.preventDefault();
    const value = memoryDraft.trim();

    // Checked here too so an empty/oversized draft never costs a round-trip.
    if (!value) {
      setMemoryError("Enter a value before saving.");
      return;
    }
    if (value.length > 200) {
      setMemoryError("Keep a personalization under 200 characters.");
      return;
    }

    setMemoryBusyId(memoryId);
    setMemoryError(null);
    try {
      const updated = await updateMemory(memoryId, { value });
      setMemories((current) => current.map((memory) => (memory.id === memoryId ? updated : memory)));
      setEditingMemoryId(null);
      setMemoryDraft("");
    } catch (err) {
      setMemoryError(err instanceof ApiError ? err.message : "Could not update that personalization.");
    } finally {
      setMemoryBusyId(null);
    }
  }

  async function handleClearMemories() {
    setClearingMemories(true);
    setMemoryError(null);
    try {
      await clearMemories();
      setMemories([]);
    } catch (err) {
      setMemoryError(err instanceof ApiError ? err.message : "Could not clear memories.");
    } finally {
      setClearingMemories(false);
    }
  }

  function startAddingMemory() {
    const [firstFreeKey] = MEMORY_KEYS.filter((key) => !memories.some((memory) => memory.key === key));
    if (!firstFreeKey) return;
    setNewMemoryKey(firstFreeKey);
    setNewMemoryValue("");
    setMemoryError(null);
    setAddingMemory(true);
  }

  function cancelAddingMemory() {
    setAddingMemory(false);
    setNewMemoryValue("");
  }

  async function handleCreateMemory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = newMemoryValue.trim();

    // Checked here too so an empty/oversized draft never costs a round-trip.
    if (!value) {
      setMemoryError("Enter a value before saving.");
      return;
    }
    if (value.length > 200) {
      setMemoryError("Keep a personalization under 200 characters.");
      return;
    }

    setSavingNewMemory(true);
    setMemoryError(null);
    try {
      const created = await createMemory({ key: newMemoryKey, value });
      // One value per key: swap out any stale copy rather than list it twice.
      setMemories((current) => [created, ...current.filter((memory) => memory.key !== created.key)]);
      cancelAddingMemory();
    } catch (err) {
      setMemoryError(err instanceof ApiError ? err.message : "Could not save that personalization.");
    } finally {
      setSavingNewMemory(false);
    }
  }

  /** Slots with no value yet — the others are already listed below. */
  const availableMemoryKeys = MEMORY_KEYS.filter((key) => !memories.some((memory) => memory.key === key));

  if (!user) return null;

  return (
    <main className="page-shell">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
        <p className="mt-1 text-sm text-muted">Update your clinic account details.</p>
      </div>

      <div className="space-y-6">
        <Card>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              {/* Without a photo the avatar falls back to a single letter — the
                  first letter of the first name ("Prakash" -> "P"). ``Avatar``
                  takes one initial per whitespace-separated word, so it is given
                  the first name alone rather than the full display name. */}
              <Avatar name={firstName.trim() || displayName(user)} imageUrl={photo} className="h-20 w-20 text-xl" />
              <div className="flex flex-wrap gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhoto}
                />
                <Button type="button" variant="secondary" onClick={() => fileInputRef.current?.click()}>
                  Change photo
                </Button>
                {photo && (
                  <Button type="button" variant="ghost" onClick={() => setPhoto(null)}>
                    Remove photo
                  </Button>
                )}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="First name" htmlFor="profile-name">
                <TextInput
                  id="profile-name"
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                  required
                  minLength={1}
                  maxLength={120}
                />
              </Field>
              <Field label="Last name" htmlFor="profile-last-name" hint="optional">
                <TextInput
                  id="profile-last-name"
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                  maxLength={120}
                />
              </Field>
              <Field label="Phone" htmlFor="profile-phone" hint="optional">
                <TextInput
                  id="profile-phone"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  minLength={7}
                  maxLength={30}
                />
              </Field>
              <Field label="Date of birth" htmlFor="profile-dob" hint="optional">
                <TextInput
                  id="profile-dob"
                  type="date"
                  value={dateOfBirth}
                  onChange={(event) => setDateOfBirth(event.target.value)}
                />
              </Field>
              <Field label="Gender" htmlFor="profile-gender" hint="optional">
                <SelectInput
                  id="profile-gender"
                  value={gender}
                  onChange={(event) => setGender(event.target.value)}
                >
                  <option value="">Not specified</option>
                  {GENDER_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </SelectInput>
              </Field>
            </div>

            <Field label="Address" htmlFor="profile-address" hint="optional">
              <TextInput
                id="profile-address"
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                maxLength={500}
              />
            </Field>

            <label className="flex items-start gap-3 rounded-lg border border-line bg-surface-muted px-3 py-3">
              <input
                type="checkbox"
                checked={memoryEnabled}
                onChange={(event) => setMemoryEnabled(event.target.checked)}
                className="mt-1 h-4 w-4 rounded border-line accent-brand-600"
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium">Personalizations</span>
                <span className="mt-0.5 block text-xs leading-5 text-muted">
                  Let the assistant remember stable preferences for future chats.
                </span>
              </span>
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Email">
                <TextInput value={user.email} disabled />
              </Field>
              <Field label="Role">
                <TextInput value={user.role} disabled />
              </Field>
            </div>

            {error && <Alert tone="danger">{error}</Alert>}
            {success && <Alert tone="success">Profile updated.</Alert>}

            <div className="flex justify-end">
              <Button type="submit" loading={saving}>
                Save profile
              </Button>
            </div>
          </form>
        </Card>

        <Card
          title="Personalizations"
          subtitle={
            memoryEnabled
              ? "Preferences the assistant remembers for future chats. Add your own, or edit a value to change what it uses."
              : "Personalizations are paused, so nothing new is saved for future chats."
          }
          action={
            <div className="flex flex-wrap gap-2">
              {!addingMemory && availableMemoryKeys.length > 0 && (
                <Button variant="secondary" size="sm" onClick={startAddingMemory}>
                  Add personalization
                </Button>
              )}
              {memories.length > 0 && (
                <Button variant="danger" size="sm" loading={clearingMemories} onClick={handleClearMemories}>
                  Clear all
                </Button>
              )}
            </div>
          }
        >
          {memoryError && <Alert tone="danger" className="mb-4">{memoryError}</Alert>}

          {addingMemory && (
            <form className="mb-4 rounded-lg border border-line bg-surface-muted p-4" onSubmit={handleCreateMemory}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <Field label="What to remember" className="w-full sm:w-56">
                  <SelectInput
                    value={newMemoryKey}
                    onChange={(event) => {
                      if (isMemoryKey(event.target.value)) setNewMemoryKey(event.target.value);
                    }}
                    aria-label="Personalization type"
                  >
                    {availableMemoryKeys.map((key) => (
                      <option key={key} value={key}>
                        {memoryLabel(key)}
                      </option>
                    ))}
                  </SelectInput>
                </Field>
                <Field label="Value" className="flex-1">
                  <TextInput
                    value={newMemoryValue}
                    onChange={(event) => setNewMemoryValue(event.target.value)}
                    maxLength={200}
                    placeholder="e.g. Morning appointments"
                    aria-label="Personalization value"
                  />
                </Field>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="submit" size="sm" loading={savingNewMemory}>
                  Save
                </Button>
                <Button variant="secondary" size="sm" onClick={cancelAddingMemory}>
                  Cancel
                </Button>
              </div>
            </form>
          )}

          {loadingMemories ? (
            <LoadingBlock label="Loading memories..." />
          ) : memories.length === 0 ? (
            <EmptyState
              title="No personalizations yet"
              description="Preferences you share in chat are saved here automatically — or press Add personalization to save one yourself."
            />
          ) : (
            <div className="divide-y divide-line">
              {memories.map((memory) => {
                const editing = editingMemoryId === memory.id;
                return (
                  <div key={memory.id} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="brand">{memoryLabel(memory.key)}</Badge>
                        {!editing && <p className="text-sm leading-6 text-foreground">{memory.value}</p>}
                      </div>
                      {editing ? (
                        <form
                          className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center"
                          onSubmit={(event) => handleUpdateMemory(event, memory.id)}
                        >
                          <TextInput
                            value={memoryDraft}
                            onChange={(event) => setMemoryDraft(event.target.value)}
                            maxLength={200}
                            aria-label={`${memoryLabel(memory.key)} value`}
                            className="w-full sm:max-w-xs"
                          />
                          <div className="flex flex-wrap gap-2">
                            <Button type="submit" size="sm" loading={memoryBusyId === memory.id}>
                              Save
                            </Button>
                            <Button variant="secondary" size="sm" onClick={cancelEditingMemory}>
                              Cancel
                            </Button>
                          </div>
                        </form>
                      ) : (
                        <p className="mt-1 text-xs text-muted">
                          Updated {formatMemoryDate(memory.updated_at)}
                        </p>
                      )}
                    </div>
                    {!editing && (
                      <div className="flex flex-wrap gap-2">
                        <Button variant="secondary" size="sm" onClick={() => startEditingMemory(memory)}>
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          loading={memoryBusyId === memory.id}
                          onClick={() => handleDeleteMemory(memory.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </main>
  );
}
