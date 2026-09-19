"use client";

import { useRef, useState, type ChangeEvent, type FormEvent } from "react";

import { useAuth } from "@/components/auth/auth-provider";
import { Avatar, Button, Card, Field, TextInput, Alert } from "@/components/ui";
import { updateMe } from "@/lib/api";
import { ApiError } from "@/lib/api";

const MAX_PHOTO_BYTES = 180_000;

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read the selected photo."));
    reader.readAsDataURL(file);
  });
}

export function ProfileView() {
  const { user, setCurrentUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fullName, setFullName] = useState(user?.full_name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [photo, setPhoto] = useState<string | null>(user?.profile_photo_url ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

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
      setError("Choose a smaller image, under 180 KB.");
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
        full_name: fullName.trim(),
        phone: phone.trim() || null,
        profile_photo_url: photo,
      });
      setCurrentUser(updated);
      setFullName(updated.full_name);
      setPhone(updated.phone ?? "");
      setPhoto(updated.profile_photo_url);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update your profile.");
    } finally {
      setSaving(false);
    }
  }

  if (!user) return null;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
        <p className="mt-1 text-sm text-muted">Update your clinic account details.</p>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <Avatar name={fullName || user.full_name} imageUrl={photo} className="h-20 w-20 text-xl" />
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
            <Field label="Full name" htmlFor="profile-name">
              <TextInput
                id="profile-name"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                required
                minLength={2}
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
          </div>

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
    </main>
  );
}
