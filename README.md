This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Roles

| Role | Who | Sees in the nav |
| --- | --- | --- |
| `patient` | default on sign-up | Chat, Availability, My appointments |
| `staff` | clinic front desk | + Doctors (schedules), Appointments (all) |
| `admin` | superset of staff | + Team (account & role management) |

Registration always creates a `patient`. Staff and admin accounts are issued by
an administrator (backend `python -m app.cli create-user … --role staff|admin`)
or from the admin **Team** page. The nav is filtered by role for convenience
(`lib/roles.ts`); every page re-checks the role on the server
(`requireRole` in `app/*/page.tsx`) and the backend enforces the same rules on
the API regardless.

Demo accounts in the dev database (see the backend README to change them):
`staff@novacare.dev` (staff) and `admin@novacare.dev` (admin), password
`Clinic@12345`. The patient demo `frontend-test@example.com` / `secret12345`
also remains.

## Authentication
## Authentication

The frontend implements the backend's JWT auth (`/api/auth/*`) without ever
exposing the access token to JavaScript:

| Piece | Responsibility |
| --- | --- |
| `app/login/page.tsx` + `components/auth/login-form.tsx` | Sign-in / registration form |
| `app/api/session/login|register|logout/route.ts` | Exchange credentials with the backend and store the token in an **httpOnly, SameSite=Lax** cookie (`clinic_session`) |
| `lib/auth-server.ts` | Server-side cookie helpers (`getSessionUser`, `requireSession`) |
| `app/api/clinic/[[...path]]/route.ts` | Reads the cookie and forwards it as `Authorization: Bearer …` |
| `components/auth/auth-provider.tsx` | Client session state (`useAuth`), sign-out, and redirect to `/login` when an API call returns 401 |

Protected pages (`/`, `/schedules`, `/appointments`, `/availability`,
`/my-appointments`) call `requireSession()` and redirect to `/login?next=…` when
no valid cookie is present. The backend remains the source of truth: it verifies
the token on every request, so client-side checks are convenience only.

### Patient self-service (`/my-appointments`)

`components/my-appointments/my-appointments-view.tsx` is the patient-facing page
linked from the main navigation. It lists the signed-in patient's own bookings
(`GET /appointments/me`) and lets them, without phoning the clinic:

- open an appointment to see the full detail (doctor, patient, contact, status,
  confirmation state) — `GET /appointments/me/{id}`;
- edit details or reschedule — `PUT /appointments/me/{id}`. The reschedule picker
  asks the backend for the doctor's open slots with
  `exclude_appointment_id=<theirs>`, so the patient's own slot still reads as
  free, and the confirmation email is sent again after a move;
- cancel with an inline confirmation step — `POST /appointments/me/{id}/cancel`,
  which releases the slot for other patients.

Ownership is the booking's email: the API answers **404** (not 403) for someone
else's appointment, so the existence of other bookings is never leaked.

A development account exists in the local database:
`frontend-test@example.com` / `secret12345`. Remove it with:

```sql
DELETE FROM user_account WHERE email = 'frontend-test@example.com';
```

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
