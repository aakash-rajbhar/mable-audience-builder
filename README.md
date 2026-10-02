# Mable Audience Builder

A small audience-building application. Operators define audience conditions against anonymous event data and preview which users match.

---

## Prerequisites

| Requirement | Version |
|---|---|
| Node.js | 20 or later |
| npm | 9 or later |
| `node-gyp` build tools | Required by `better-sqlite3` |

On Debian/Ubuntu: `sudo apt-get install python3 make g++`  
On macOS: `xcode-select --install`

---

## Quickstart

### 1. Clone and enter the repository

```bash
git clone <repo-url>
cd mable-audience-builder
```

### 2. Install and start the backend

```bash
cd backend
npm install
npm run dev        # development — auto-reloads on file changes
# or
npm run start      # production — compiles TypeScript then runs node
```

The backend starts on **http://localhost:3000**. On first start it automatically seeds the SQLite database with synthetic event data — no manual seed step needed.

To re-seed from scratch (after deleting `backend/data/events.db`):

```bash
npm run seed
```

### 3. Install and start the frontend

In a second terminal:

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

The frontend starts on **http://localhost:5173**.

---

## Running the tests

```bash
cd backend
npm test
```

All 31 tests should pass. Tests use an in-memory SQLite database — they do not touch the seeded file.

---

## How to preview an audience

1. Open **http://localhost:5173** in a browser.
2. The form is pre-filled with the reference scenario (product views ≥ 2, purchases = 0, within 7 days of 2026-09-29).
3. Click **Preview audience**.
4. The backend evaluates the conditions against seeded data and returns matching users with evidence.
5. Change conditions and click **Preview audience** again to re-run.
6. To test error handling: stop the backend and click **Retry** — a network error message appears with a Retry button.

---

## Environment variables

### Backend

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | HTTP port |
| `DATABASE_PATH` | `data/events.db` | Path to the SQLite database file |
| `CORS_ORIGIN` | `http://localhost:5173` | Allowed CORS origin |

### Frontend

| Variable | Default | Description |
|---|---|---|
| `VITE_API_BASE_URL` | `http://localhost:3000` | Backend base URL |

---

## Repository structure

```
mable-audience-builder/
├── backend/
│   ├── src/
│   │   ├── db/
│   │   │   ├── database.ts       # SQLite schema + factory functions
│   │   │   └── seed.ts           # Deterministic synthetic event data
│   │   ├── routes/
│   │   │   ├── audience.ts       # POST /v1/audiences/preview
│   │   │   └── health.ts         # GET /health
│   │   ├── schemas/
│   │   │   └── audience.ts       # Zod validation schema
│   │   ├── services/
│   │   │   ├── evaluator.ts      # Pure condition evaluation logic
│   │   │   └── audienceService.ts # DB-backed audience evaluation
│   │   ├── types/
│   │   │   └── audience.ts       # TypeScript domain types
│   │   ├── app.ts                # Express app factory (DB-injected)
│   │   └── server.ts             # Entry point
│   └── tests/
│       ├── evaluator.test.ts     # Pure function unit tests
│       └── api.test.ts           # Integration tests via supertest
├── frontend/
│   └── src/
│       ├── api/
│       │   └── audienceApi.ts    # Fetch wrapper, typed error classes
│       ├── components/
│       │   ├── AudienceForm.tsx  # Main form + state management
│       │   ├── AudienceResults.tsx
│       │   └── ConditionRow.tsx
│       └── types/
│           └── audience.ts       # Types matching backend API contract
└── docs/
    ├── DESIGN.md
    └── AI_USAGE.md
```
