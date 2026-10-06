# Clinic Agent Frontend

Next.js frontend for the Clinic Agent system. It provides the chat workspace,
appointment booking UI, patient self-service pages, staff schedule management,
clinic appointment management, profile controls, and admin user management.

## Features

- Chat interface for the backend multi-agent clinic assistant
- Role-aware navigation for patient, staff, and admin users
- Patient appointment list, detail view, reschedule, and cancellation flow
- Staff/admin doctor schedule and clinic appointment management
- Admin team management for user accounts and roles
- Profile page with contact details, profile photo, and memory controls
- Same-origin API proxy so browser code never talks to the backend directly
- httpOnly cookie session handling for access and refresh tokens

## Frontend Flow

The frontend keeps authentication and backend access on the server side. Client
components call same-origin routes, and Next route handlers attach the backend
token from httpOnly cookies.

```text
Browser
    |
    v
Next.js page or client component
    |
    +--> Protected page request
    |       |
    |       v
    |   Server component guard
    |       - requireSession() for signed-in pages
    |       - requireRole() for staff/admin pages
    |       |
    |       v
    |   Render page or redirect to /login or /forbidden
    |
    +--> Login / register form
    |       |
    |       v
    |   /api/session/login or /api/session/register
    |       - forwards credentials to FastAPI
    |       - stores access token in clinic_session httpOnly cookie
    |       - stores refresh token in clinic_refresh httpOnly cookie
    |
    +--> App data request
            |
            v
        lib/api.ts calls /api/clinic/*
            |
            v
        Next proxy route
            - reads clinic_session cookie
            - adds Authorization: Bearer <token>
            - refreshes tokens when needed
            |
            v
        FastAPI backend
            - verifies auth and roles
            - runs chat, booking, schedules, appointments, memories, users
```

## Tech Stack

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS
- pnpm
- Docker

## Requirements

- Node.js 22
- pnpm 10
- Docker and Docker Compose
- Running Clinic Agent backend

## Quick Start With Docker

Create an environment file if needed:

```bash
cp .env.example .env
```

Start the frontend:

```bash
docker compose up -d --build
```

The app is available at:

- `http://localhost:3000`
- `http://localhost:3000/login`

By default, Docker Compose sends backend requests to:

```env
FRONTEND_BACKEND_URL=http://host.docker.internal:8000
```

Use this when the backend is running on the host machine. Override it if the
backend is elsewhere:

```bash
FRONTEND_BACKEND_URL=http://your-backend-host:8000 docker compose up -d --build
```

## Local Development

Install dependencies:

```bash
pnpm install
```

Copy and edit the environment file:

```bash
cp .env.example .env
```

Set the backend URL:

```env
BACKEND_URL=http://127.0.0.1:8000
```

Start the development server:

```bash
pnpm dev
```

Open `http://localhost:3000`.

## Configuration

| Variable | Purpose |
| --- | --- |
| `BACKEND_URL` | Server-side FastAPI base URL used by Next route handlers |
| `FRONTEND_BACKEND_URL` | Docker Compose override for `BACKEND_URL` inside the container |
| `FRONTEND_PORT` | Host port for the frontend container, default `3000` |

Do not expose backend tokens to client-side JavaScript. The frontend stores
tokens only in httpOnly cookies.

## Roles

| Role | Main pages |
| --- | --- |
| `patient` | Chat, availability, profile, my appointments |
| `staff` | Patient pages plus doctors/schedules and clinic appointments |
| `admin` | Staff pages plus team/user management |

The frontend filters navigation and guards pages for usability. The backend is
still the source of truth and enforces authorization for every API request.

## Main Pages

- `/login` - sign in and registration
- `/` - chat workspace
- `/availability` - doctor availability
- `/my-appointments` - signed-in patient's bookings
- `/profile` - profile and memory controls
- `/doctor` - doctor schedule management
- `/appointments` - clinic-wide appointment management
- `/users` - admin team management
- `/forbidden` - role-denied page

## Scripts

```bash
pnpm dev
pnpm build
pnpm start
pnpm lint
```

## Backend Contract

The frontend expects the backend API from `clinic-agent-backend` to be running
and reachable through `BACKEND_URL`. Browser requests go to `/api/clinic/*`;
the proxy forwards them to FastAPI and attaches the bearer token server-side.
