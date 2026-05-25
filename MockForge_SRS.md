# Software Requirements Specification (SRS)

## Project: MockForge — Schema-Driven Mock API & Seeder Gateway

**Version:** 1.3.0  
**Status:** Draft  
**Last Updated:** 2026-05-25  
**Authors:** MockForge Core Team

> **v1.3.0 change:** Migrated entire codebase spec from JavaScript/JSX to **TypeScript/TSX**. All backend modules use ESM + TypeScript. React dashboard uses TSX with Vite's `react-ts` template. Shared type definitions live in `shared/types.ts`.

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [General Description](#2-general-description)
3. [System Features & Functional Requirements](#3-system-features--functional-requirements)
4. [External Interface Requirements](#4-external-interface-requirements)
5. [Non-Functional Requirements](#5-non-functional-requirements)
6. [Data Models & Schema Mapping Reference](#6-data-models--schema-mapping-reference)
7. [Error Handling & Edge Cases](#7-error-handling--edge-cases)
8. [MVP Scope & Phase Roadmap](#8-mvp-scope--phase-roadmap)
9. [Architecture Blueprint](#9-architecture-blueprint)
10. [Glossary](#10-glossary)

---

## 1. Introduction

### 1.1 Purpose

This document specifies all software requirements for **MockForge**, a local developer utility that automatically generates a fully functional mock REST API and realistic seed data from a user-supplied database schema or JSON structure, served alongside an integrated React dashboard — all from a single terminal command.

It serves as the single source of truth for developers building, testing, and extending MockForge, covering functional requirements, system constraints, interface specs, and a phase-based delivery roadmap.

### 1.2 Scope

MockForge eliminates the bottleneck of waiting for backend API implementation during frontend or mobile development. A developer pastes a schema — Prisma, SQL DDL, or plain JSON — and instantly receives:

- A live local REST server with realistic, relationally aware dummy data supporting full CRUD operations
- A browser-based React dashboard for schema management, route exploration, and live request monitoring

Both the mock API engine and the React dashboard are launched from a **single terminal command** with zero configuration required.

**In scope for this document:**
- JSON and Prisma schema parsing
- Dynamic REST route generation
- Seeded in-memory state management
- React dashboard (served by Express as static files in production; via Vite dev server in development)
- Single-command startup delivering both backend and frontend
- CLI interface with colour-coded logs
- Relational integrity between generated records

**Out of scope:**
- GraphQL endpoints (Phase 3+)
- Cloud deployment or remote hosting
- Authentication / Authorization simulation
- Database migration tooling

### 1.3 Definitions, Acronyms, and Abbreviations

| Term | Definition |
|---|---|
| Schema | A structured definition of data models and their fields |
| Model | A single entity/table definition within a schema (e.g., `User`, `Post`) |
| Seeding | Auto-generating realistic dummy records for a model |
| CRUD | Create, Read, Update, Delete — standard data operations |
| SPA | Single Page Application |
| DDL | Data Definition Language (e.g., SQL `CREATE TABLE` statements) |
| Faker | A library that generates realistic fake data (names, emails, dates, etc.) |
| In-memory state | Application data stored in RAM, lost on process exit |
| lowdb | A lightweight local JSON database backed by a flat file |
| SSE | Server-Sent Events — a protocol for streaming real-time data from server to browser |
| Vite | A fast frontend build tool and dev server for React/Vue projects |
| concurrently | An npm tool that runs multiple terminal processes from a single command |
| tsx | A TypeScript executor for Node.js (replaces `ts-node` for ESM compatibility) |

### 1.4 References

- [Faker.js Documentation](https://fakerjs.dev)
- [Express.js Documentation](https://expressjs.com)
- [Prisma Schema Reference](https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference)
- [Vite Documentation](https://vitejs.dev)
- [React Documentation](https://react.dev)
- [TypeScript Documentation](https://www.typescriptlang.org/docs)
- [concurrently](https://github.com/open-cli-tools/concurrently)
- [tsx](https://github.com/privatenumber/tsx)
- [json-server](https://github.com/typicode/json-server) — comparable open-source project

### 1.5 Overview

Section 3 defines all functional requirements. Section 5 defines non-functional constraints. Section 8 separates MVP features from future-phase features. Section 9 provides the full architecture blueprint — including frontend structure and single-command delivery — to begin implementation immediately.

---

## 2. General Description

### 2.1 Product Perspective

MockForge operates as a lightweight, standalone local tool combining a Node.js mock API engine with a React SPA dashboard. The developer runs one command; the tool handles everything else.

```
┌──────────────────────────────────────────────────────────┐
│                  Single Terminal Command                  │
│              $ mockforge ./schema.json                    │
└───────────────────┬──────────────────────────────────────┘
                    │ spawns
        ┌───────────┴────────────┐
        ▼                        ▼
┌───────────────┐       ┌─────────────────────┐
│  Express API  │       │  React Dashboard    │
│  :5000/api/*  │◄──────│  :5000/dashboard    │
│               │  HTTP │  (served as static  │
│  Mock CRUD    │       │   files by Express) │
│  Endpoints    │       └─────────────────────┘
└───────┬───────┘
        │
        ▼
┌───────────────┐
│  Your App     │  ← React, Vue, Next, Flutter, Postman…
│  (any client) │
└───────────────┘
```

In **development mode** (`npm run dev`), Express and the Vite dev server run in parallel via `concurrently`, with Vite proxying API calls to Express. In **production/distribution mode** (`npm start`), Express serves the pre-built Vite output as static files — one server, one port, one command.

### 2.2 Product Functions

| Function | Description |
|---|---|
| Schema Parsing | Ingests JSON or Prisma schema text and extracts model names, fields, and types |
| Dynamic Route Generation | Mounts REST endpoints automatically for every detected model |
| Smart Data Seeding | Infers context from field names and types; uses Faker.js to generate realistic values |
| Relational Integrity | Ensures foreign-key style references (e.g., `Post.userId`) point to valid seeded IDs |
| State Mutation | Supports full in-memory CRUD that mutates shared server state |
| Reset Endpoint | Reverts server state to initial seed data at any time |
| Live Logging (CLI) | Colour-coded terminal logs of all incoming requests with method, path, status, and latency |
| React Dashboard | Browser UI for schema management, route exploration, live logs, and data reset |
| Single-Command Delivery | One command starts the full stack — API engine + React dashboard — with no manual steps |

### 2.3 User Classes and Characteristics

**Frontend / Mobile Developers**
- Primary users. Need a stable, predictable API surface immediately after schema design.
- May prefer the dashboard UI over editing JSON files directly.
- Will consume the API from React, Vue, Next.js, Flutter, or similar stacks.

**Full-Stack Developers / Architects**
- Use MockForge to prototype schema shapes and validate data relationships early.
- Comfortable with Node.js and TypeScript; may prefer the CLI over the dashboard.
- Interested in seeding volume control and reset mechanisms for automated tests.

**QA / Test Engineers**
- Need a deterministic, resettable data source for integration test suites.
- Use `POST /api/reset` to establish a known baseline before each test run.
- Will automate via CLI flags; dashboard is incidental to their workflow.

### 2.4 Assumptions and Dependencies

- Node.js v18+ is installed on the developer's machine.
- `npm` or `yarn` is available for dependency installation.
- The user provides a valid, well-formed schema; malformed schemas degrade gracefully with a clear error.
- MockForge is run locally; network security is not a concern for MVP.
- For development mode, ports `5000` (Express) and `5173` (Vite) must be available, or the tool auto-selects alternatives.

### 2.5 Constraints

- Must run without a cloud database — all state is local.
- Must not require Docker or any containerisation for MVP execution.
- Must complete cold startup (parse + seed + server bind + dashboard serve) in under 5 seconds.
- The dashboard must be usable without an internet connection — no CDN-hosted assets in production build.
- The React dashboard must **not** be a separate deployment; it must be co-located with and served by the same Express server process.

---

## 3. System Features & Functional Requirements

> Requirements are labelled `FR-[module].[number]`.  
> Priority: **MUST** = required for MVP, **SHOULD** = high value but deferrable, **MAY** = stretch goal.

---

### 3.1 Schema Ingestion & Parsing Engine

**FR-1.1 (MUST):** The system must accept a plain JSON object as schema input. The JSON must describe one or more named models, each containing a map of field names to type strings.

Example valid input:
```json
{
  "User": {
    "id": "uuid",
    "name": "string",
    "email": "email",
    "createdAt": "date"
  },
  "Post": {
    "id": "uuid",
    "title": "string",
    "body": "text",
    "userId": "uuid"
  }
}
```

**FR-1.2 (SHOULD):** The system should accept a raw Prisma schema string and parse `model` blocks, extracting:
- Model names
- Field names and their Prisma scalar types (`String`, `Int`, `Boolean`, `DateTime`, `Float`)
- Relation fields (annotated with `@relation`)

**FR-1.3 (MUST):** The parser must map input field types and names to Faker.js generator categories according to the type-hint table in Section 6.

**FR-1.4 (MUST):** If the schema is malformed or unrecognisable, the system must exit with a clear, human-readable error message and a non-zero exit code. It must not silently continue with partial data.

**FR-1.5 (SHOULD):** The system should detect probable foreign key fields (fields ending in `Id` or `_id`) and mark them for relational seeding rather than random ID generation.

**FR-1.6 (MUST):** The dashboard must be able to submit a new schema at runtime (without restarting the server) via `POST /api/_schema/reload`. The engine must re-parse, re-seed, and re-mount routes in response.

---

### 3.2 Dynamic Mock API Engine

**FR-2.1 (MUST):** On startup, the system must bind Express to port `5000` by default. If occupied, it must attempt ports `5001`–`5010` sequentially and report the bound port clearly in terminal and in the dashboard.

**FR-2.2 (MUST):** For every parsed model, the system must expose standard CRUD routes using the pluralised, lowercased model name (e.g., `User` → `/api/users`):

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/:model` | Returns all records. Supports `?_limit=N` and `?_page=N`. |
| `GET` | `/api/:model/:id` | Returns a single record by ID. |
| `POST` | `/api/:model` | Creates a new record. Auto-assigns `id` if not in body. |
| `PUT` | `/api/:model/:id` | Full replacement of a record by ID. |
| `PATCH` | `/api/:model/:id` | Partial update of a record by ID. |
| `DELETE` | `/api/:model/:id` | Removes a record by ID. |

**FR-2.3 (MUST):** All responses must include `Content-Type: application/json` and correct HTTP status codes (`200`, `201`, `400`, `404`, `500`).

**FR-2.4 (MUST):** All responses must include `Access-Control-Allow-Origin: *` so client apps on any local port can consume the API without CORS errors.

**FR-2.5 (SHOULD):** `GET /api/:model` must support simple field filtering via query params (e.g., `/api/users?role=admin`).

**FR-2.6 (MUST):** The system must expose the following internal control endpoints:

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/reset` | Wipes state and re-seeds all models to initial baseline |
| `GET` | `/api/_routes` | Returns a JSON list of all active routes (used by the dashboard) |
| `GET` | `/api/_stats` | Returns per-model record counts and total request counts |
| `POST` | `/api/_schema/reload` | Accepts a new schema JSON body, re-parses and re-seeds |
| `GET` | `/api/_logs/stream` | SSE endpoint streaming real-time request log events to the dashboard |

---

### 3.3 Seeder & State Management Engine

**FR-3.1 (MUST):** On server initialisation, the system must auto-generate a configurable number of seed records per model. Default: **10 records per model**. Overridable via `--seed N` CLI flag or config file.

**FR-3.2 (MUST):** The in-memory state must persist for the lifetime of the server process. All CRUD mutations must reflect immediately in subsequent reads within the same session.

**FR-3.3 (MUST):** `POST /api/reset` must wipe current state and re-run the seeder, restoring the initial baseline. Response: `200 OK` with a summary of records restored per model.

**FR-3.4 (SHOULD):** The system should support opt-in file persistence via `--persist` flag, using `lowdb` to write state to `db.json` so data survives a process restart.

**FR-3.5 (SHOULD):** Relational fields (see FR-1.5) must be seeded with a valid ID drawn from the related model's already-seeded record pool.

---

### 3.4 Configuration

**FR-4.1 (MUST):** The system must accept a schema file path as a positional CLI argument: `mockforge ./schema.json`.

**FR-4.2 (SHOULD):** The system should support a `mockforge.config.json` file in the project root:

```json
{
  "port": 5000,
  "seedCount": 10,
  "persist": false,
  "schema": "./schema.json",
  "openDashboard": true
}
```

**FR-4.3 (SHOULD):** CLI flags must take precedence over config file values, which take precedence over defaults.

**FR-4.4 (SHOULD):** When `openDashboard: true` is set (or `--open` flag is passed), the tool should automatically open `http://localhost:5000/dashboard` in the default browser on startup.

---

### 3.5 React Dashboard

**FR-5.1 (MUST):** The dashboard must be a React SPA served by Express at `http://localhost:<port>/dashboard`. It must be built with Vite (using the `react-ts` template) and co-located in the same repository under a `dashboard/` directory.

**FR-5.2 (MUST):** The dashboard must display, on load:
- All active API route paths, grouped by model, with their HTTP methods
- Current record count per model
- Server port and uptime

**FR-5.3 (MUST):** The dashboard must include a **Schema Editor** — a text area pre-populated with the current schema JSON — with a **"Reload Schema"** button that calls `POST /api/_schema/reload` and updates the route list without a page refresh.

**FR-5.4 (MUST):** The dashboard must include a **Live Request Log** panel displaying real-time incoming requests via SSE (`GET /api/_logs/stream`), showing method, path, status code, and response time. The log must be scrollable and capped at the last 200 entries.

**FR-5.5 (MUST):** The dashboard must include a **"Reset Data"** button that calls `POST /api/reset` and shows a success toast with the count of records restored.

**FR-5.6 (SHOULD):** The dashboard should include a **Data Explorer** panel — a dropdown of model names that loads and displays the current records for the selected model in a paginated table.

**FR-5.7 (SHOULD):** The dashboard should display a copyable `curl` example for each route (generated client-side from the route list).

**FR-5.8 (MAY):** The dashboard may include a dark/light mode toggle, persisted to `localStorage`.

---

## 4. External Interface Requirements

### 4.1 Single-Command Startup — The Delivery Contract

This is a first-class requirement. A developer must be able to run MockForge with a single command and receive both the mock API and the dashboard — no second terminal, no manual browser step (when `--open` is set), no build step required by the user.

**Development mode** (for MockForge contributors):
```bash
npm run dev
# Starts: Express (via tsx watch) on :5000 + Vite on :5173 via concurrently
# Vite proxies /api/* → Express :5000
# Dashboard: http://localhost:5173/dashboard
```

**User / distribution mode** (what end users run):
```bash
npm run build          # compiles TypeScript → dist/ AND builds Vite output → dashboard/dist/
mockforge ./schema.json --open
# Express on :5000 serves both /api/* and /dashboard (static from dashboard/dist/)
# --open auto-launches http://localhost:5000/dashboard in the browser
```

The `package.json` scripts must encode this contract clearly:

```json
{
  "scripts": {
    "dev": "concurrently \"tsx watch src/server.ts\" \"vite dashboard/\"",
    "build": "tsc -p tsconfig.json && vite build dashboard/",
    "start": "node dist/bin/mockforge.js"
  }
}
```

### 4.2 Command Line Interface

The CLI must display at startup:

```
╔══════════════════════════════════════╗
║   MockForge v1.0.0                   ║
╚══════════════════════════════════════╝

  Parsed 3 models: users, posts, comments
  Seeded 10 records per model (30 total)

  Mock API  →  http://localhost:5000/api
  Dashboard →  http://localhost:5000/dashboard

  [GET]    /api/users
  [GET]    /api/users/:id
  [POST]   /api/users
  [PUT]    /api/users/:id
  [PATCH]  /api/users/:id
  [DELETE] /api/users/:id
  ... (repeated per model)

──────────────────────────────────────────
  Watching for requests…

[GET]    200  /api/users          12ms
[POST]   201  /api/posts           8ms
[GET]    404  /api/users/abc-123   3ms
```

Colour coding: green for 2xx, yellow for 3xx, red for 4xx/5xx.

### 4.3 React Dashboard UI Specification

**Technology stack:**
- React 18 (functional components, hooks) — **TypeScript (TSX)**
- Vite with `@vitejs/plugin-react` — initialised via `--template react-ts`
- No UI framework dependency required — plain CSS modules or Tailwind CSS acceptable
- Fetch API for HTTP calls; `EventSource` for SSE log streaming

**Layout:**

```
┌────────────────────────────────────────────────────────────┐
│  MockForge Dashboard                     [Reset Data] [⚙️] │
├──────────────┬─────────────────────────────────────────────┤
│              │                                             │
│  Routes      │   Live Request Log                          │
│  ─────────   │   ──────────────                            │
│  GET /users  │   [GET]  200  /api/users       12ms        │
│  POST /users │   [POST] 201  /api/posts        8ms        │
│  GET /posts  │   [GET]  404  /api/users/x      3ms        │
│  ...         │                                             │
├──────────────┼─────────────────────────────────────────────┤
│  Schema Editor                                             │
│  ┌──────────────────────────────────────────────────────┐ │
│  │  { "User": { "id": "uuid", "email": "email" ... } } │ │
│  └──────────────────────────────────────────────────────┘ │
│  [Reload Schema]                                           │
├──────────────────────────────────────────────────────────── │
│  Data Explorer  [Model ▾]  Page 1 of 3  [← Prev] [Next →] │
│  ┌────────────────────────────────────────────────────────┐│
│  │ id           │ name         │ email                    ││
│  │ uuid-abc-123 │ Jane Doe     │ jane@example.com         ││
│  └────────────────────────────────────────────────────────┘│
└────────────────────────────────────────────────────────────┘
```

**Vite proxy config** (for development mode, `dashboard/vite.config.ts`):

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:5000'
    }
  }
});
```

This ensures all `/api/*` calls from the React app in dev mode are forwarded to Express, with no CORS issues and no hardcoded ports in React code.

### 4.4 Software Interfaces

**Backend dependencies:**

| Package | Role |
|---|---|
| `express` | HTTP server and routing |
| `@faker-js/faker` | Realistic dummy data generation |
| `chalk` | Terminal colour output |
| `commander` | CLI argument parsing |
| `pluralize` | Model name → URL slug (`User` → `users`) |
| `lowdb` v3 | Optional file-backed state persistence |
| `open` | Auto-open browser on `--open` flag |
| `concurrently` | Run Express + Vite in parallel during development |

**Backend dev dependencies (TypeScript toolchain):**

| Package | Role |
|---|---|
| `typescript` | TypeScript compiler |
| `tsx` | Run `.ts` files directly in Node.js (dev & watch mode) |
| `@types/node` | Type definitions for Node.js built-ins |
| `@types/express` | Type definitions for Express |
| `@types/pluralize` | Type definitions for pluralize |

**Frontend dependencies:**

| Package | Role |
|---|---|
| `react` + `react-dom` | UI framework |
| `vite` + `@vitejs/plugin-react` | Build tool and dev server |
| `typescript` | TypeScript compiler (included by `react-ts` template) |
| `@types/react` + `@types/react-dom` | React type definitions |

---

## 5. Non-Functional Requirements

### 5.1 Performance

| Metric | Requirement |
|---|---|
| API response latency | < 50ms per request under normal local conditions |
| Cold startup (API + dashboard serve) | < 5 seconds for schemas with up to 20 models |
| Memory footprint | < 200MB RAM total (API engine + static file serving) for datasets up to 5,000 records |
| Seed generation speed | 1,000 records across all models in < 1 second |
| Dashboard initial load | < 2 seconds on localhost (production build) |
| SSE log stream latency | < 100ms from request completion to log appearance in dashboard |

### 5.2 Usability

- End user installation: `npm install -g mockforge && mockforge ./schema.json` — nothing else.
- Invalid schema must produce a human-readable error, not a raw stack trace.
- The dashboard must work on Chrome, Firefox, and Safari (latest two major versions).
- All terminal output must be readable without colour support (for CI environments).
- The dashboard must be responsive enough to use on a laptop screen (min 1024px wide).

### 5.3 Reliability

- The API server must not crash on unrecognised request bodies — return `400` with a descriptive message.
- An unrecognised route must return `404` with a JSON body listing available models and routes.
- If the SSE connection drops, the dashboard must reconnect automatically with exponential backoff.
- The process must handle `SIGINT` and `SIGTERM` gracefully, flushing state to file if `--persist` is active.

### 5.4 Maintainability

- Source code must be modular: parser, seeder, router, store, logger, and SSE broadcaster as separate modules.
- Frontend and backend code must be cleanly separated under `src/` and `dashboard/src/` respectively.
- The type-hint mapping table (Section 6.1) must live in a single file (`typeMap.ts`) — not scattered across logic files.
- All shared data-shape contracts (model definitions, log events, API responses) must be defined once in `shared/types.ts` and imported by both backend and frontend.
- All modules must be independently testable.

### 5.5 Portability

- Must run on macOS, Linux, and Windows (WSL2 acceptable for Windows).
- Must not depend on any native compiled binaries.
- The production build (Express serving Vite output) must work without Vite or `concurrently` installed — only Express and the built static files are needed at runtime.

---

## 6. Data Models & Schema Mapping Reference

### 6.1 Field Type-Hint Mapping Table

The parser resolves each field to a Faker.js generator using this priority order:
1. Exact field name match
2. Field name pattern / suffix match
3. Declared type fallback

| Field Name / Pattern | Faker.js Method |
|---|---|
| `id`, ends with `Id` or `_id` | `faker.string.uuid()` |
| `name`, `fullName` | `faker.person.fullName()` |
| `firstName` | `faker.person.firstName()` |
| `lastName` | `faker.person.lastName()` |
| `email` | `faker.internet.email()` |
| `phone`, `phoneNumber` | `faker.phone.number()` |
| `username` | `faker.internet.userName()` |
| `password` | `faker.internet.password()` |
| `avatar`, `profilePicture` | `faker.image.avatar()` |
| `title` | `faker.lorem.sentence({ min: 3, max: 6 })` |
| `body`, `content`, `description`, `text` | `faker.lorem.paragraphs(2)` |
| `slug` | `faker.helpers.slugify(faker.lorem.words(3))` |
| `url`, `website`, `link` | `faker.internet.url()` |
| `address`, `street` | `faker.location.streetAddress()` |
| `city` | `faker.location.city()` |
| `country` | `faker.location.country()` |
| `zipCode`, `postalCode` | `faker.location.zipCode()` |
| `latitude` | `faker.location.latitude()` |
| `longitude` | `faker.location.longitude()` |
| `price`, `amount`, `cost` | `faker.commerce.price()` |
| `currency` | `faker.finance.currencyCode()` |
| `company`, `organization` | `faker.company.name()` |
| `role`, `status` | `faker.helpers.arrayElement(['admin','user','guest'])` |
| `age` | `faker.number.int({ min: 18, max: 80 })` |
| `rating` | `faker.number.float({ min: 1, max: 5, fractionDigits: 1 })` |
| `count`, `quantity` | `faker.number.int({ min: 1, max: 100 })` |
| `createdAt`, `updatedAt`, `date` | `faker.date.recent()` |
| starts with `is` or `has` | `faker.datatype.boolean()` |
| `image`, `photo`, `thumbnail` | `faker.image.url()` |
| **Type fallback: `string`** | `faker.lorem.word()` |
| **Type fallback: `int` / `number`** | `faker.number.int()` |
| **Type fallback: `boolean`** | `faker.datatype.boolean()` |
| **Type fallback: `date`** | `faker.date.recent()` |
| **Type fallback: `uuid`** | `faker.string.uuid()` |

---

## 7. Error Handling & Edge Cases

| Scenario | Expected Behaviour |
|---|---|
| Schema file path not found | Exit: `Error: Schema file not found at ./path/schema.json` |
| Schema is empty `{}` | Exit: `Error: Schema contains no models. Nothing to generate.` |
| Model has no fields | Skip model; log `Warning: Model "X" has no fields — skipped.` |
| Port already in use | Try next port up to 5010; if all fail, exit with clear message |
| `GET /api/:model` with unknown model | `404` + `{ error: "Model 'xyz' not found", available: ["users","posts"] }` |
| `POST /api/:model` with empty body | `400` + `{ error: "Request body cannot be empty" }` |
| `POST /api/_schema/reload` with invalid JSON | `400` + `{ error: "Invalid schema JSON", detail: "<parse error message>" }` |
| Circular relations between models | Two-pass seeding: first pass seeds IDs only; second pass populates relational fields |
| SSE client disconnects | Server removes the response stream from the broadcaster list; no crash |
| Vite build output missing at startup | Express logs `Warning: Dashboard build not found. Run npm run build to enable /dashboard.` and continues serving the API normally |

---

## 8. MVP Scope & Phase Roadmap

### Phase 1 — MVP (Single-Command Full Stack)

| Feature | Requirement IDs |
|---|---|
| JSON schema ingestion | FR-1.1, FR-1.3, FR-1.4 |
| Dynamic CRUD routes | FR-2.1, FR-2.2, FR-2.3, FR-2.4 |
| Control endpoints (`/reset`, `/_routes`, `/_stats`, `/_logs/stream`, `/_schema/reload`) | FR-2.6 |
| Auto-seeding (in-memory) | FR-3.1, FR-3.2, FR-3.3 |
| React dashboard (route list, live logs, schema editor, reset button) | FR-5.1 – FR-5.5 |
| Single-command delivery (Express serves built Vite output) | Section 4.1 |
| CLI startup banner + colour-coded logs | Section 4.2 |
| `--open` flag to auto-launch dashboard | FR-4.4 |

### Phase 2 — Enhanced Developer Experience

| Feature | Requirement IDs |
|---|---|
| Prisma schema parsing | FR-1.2 |
| Relational seeding | FR-1.5, FR-3.5 |
| Field filtering query params | FR-2.5 |
| File persistence (`lowdb`) | FR-3.4 |
| Dashboard: Data Explorer panel | FR-5.6 |
| Dashboard: `curl` example generator | FR-5.7 |
| Config file (`mockforge.config.json`) | FR-4.2, FR-4.3 |

### Phase 3 — Power Features

| Feature | Notes |
|---|---|
| SQL DDL parsing | Parse `CREATE TABLE` statements |
| Dark/light mode toggle in dashboard | FR-5.8 |
| GraphQL endpoint generation | Mirror REST models as GraphQL queries/mutations |
| OpenAPI spec export | Output `openapi.json` from active routes; link from dashboard |
| Webhook simulation | Trigger outbound webhooks on mutation events |
| Custom seed scripts | Allow users to override specific field generators via a TypeScript config file |

---

## 9. Architecture Blueprint

### 9.1 Project Structure

```
mockforge/
├── bin/
│   └── mockforge.ts              # CLI entry point (commander) → compiles to dist/bin/mockforge.js
├── src/
│   ├── parser/
│   │   ├── jsonParser.ts         # Parses JSON schema
│   │   └── prismaParser.ts       # (Phase 2) Parses Prisma schema strings
│   ├── seeder/
│   │   ├── seeder.ts             # Orchestrates seed generation per model
│   │   └── typeMap.ts            # Field name → Faker.js method lookup table
│   ├── router/
│   │   └── routerFactory.ts      # Dynamically mounts CRUD routes per model
│   ├── state/
│   │   └── store.ts              # In-memory state store + optional lowdb bridge
│   ├── sse/
│   │   └── broadcaster.ts        # Manages SSE client connections; broadcasts log events
│   ├── logger/
│   │   └── logger.ts             # Colour-coded terminal logger + SSE event emitter
│   └── server.ts                 # Express app assembly and startup
├── shared/
│   └── types.ts                  # Shared TypeScript interfaces (ParsedModel, LogEvent, etc.)
│                                 # imported by both src/ and dashboard/src/
├── dashboard/                    # React frontend (Vite react-ts template)
│   ├── index.html
│   ├── vite.config.ts            # Vite config with /api proxy for dev mode
│   ├── tsconfig.json             # Dashboard-specific TS config (extends root)
│   ├── dist/                     # Built output (served by Express in production)
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── components/
│       │   ├── RouteList.tsx     # Displays active routes grouped by model
│       │   ├── LiveLog.tsx       # SSE-powered real-time request log
│       │   ├── SchemaEditor.tsx  # Textarea + Reload Schema button
│       │   ├── DataExplorer.tsx  # (Phase 2) Paginated model data viewer
│       │   └── ResetButton.tsx   # Calls POST /api/reset + shows toast
│       └── api/
│           └── client.ts         # All fetch/SSE calls to the Express API
├── tsconfig.json                 # Root TypeScript config (backend)
├── mockforge.config.json         # Optional user config file
├── schema.json                   # Example schema
├── package.json
└── README.md
```

### 9.2 Full System Data Flow

```
  CLI: mockforge ./schema.json --open
            │
            ├─ 1. Parse schema.json
            │       jsonParser → { User: {...}, Post: {...} }
            │
            ├─ 2. Seed all models
            │       seeder + typeMap → store.init({ users: [...], posts: [...] })
            │
            ├─ 3. Mount Express routes
            │       routerFactory → GET/POST/PUT/PATCH/DELETE per model
            │       + control routes: /reset, /_routes, /_stats, /_schema/reload, /_logs/stream
            │
            ├─ 4. Serve dashboard
            │       express.static('dashboard/dist') → GET /dashboard → React SPA
            │
            ├─ 5. Bind server
            │       app.listen(5000)
            │
            └─ 6. Open browser (if --open)
                    open('http://localhost:5000/dashboard')

  ┌──────────────────────────────────┐
  │ Incoming Request                 │
  │  GET /api/users                  │
  └──────────┬───────────────────────┘
             │
             ▼
  ┌──────────────────────────────────┐
  │ Logger middleware (request)      │
  │  records: method, path, t_start  │
  └──────────┬───────────────────────┘
             │
             ▼
  ┌──────────────────────────────────┐
  │ Route handler                    │
  │  reads from store → sends JSON   │
  └──────────┬───────────────────────┘
             │
             ▼
  ┌──────────────────────────────────┐
  │ Logger middleware (response)     │
  │  calculates latency → logs CLI   │
  │  → broadcaster.emit(logEvent)    │
  └──────────┬───────────────────────┘
             │
             ▼
  ┌──────────────────────────────────┐
  │ SSE Broadcaster                  │
  │  pushes event to all connected   │
  │  dashboard SSE clients           │
  └──────────────────────────────────┘
```

### 9.3 Shared Types

All shared contracts live in `shared/types.ts` and are imported by both backend and frontend:

```typescript
// shared/types.ts

export interface ParsedField {
  type: string;
  isRelation?: boolean;
}

export type ParsedModel = Record<string, ParsedField>;
export type ParsedSchema = Record<string, ParsedModel>;

export interface SeededRecord {
  id: string;
  [key: string]: unknown;
}

export type SeededStore = Record<string, SeededRecord[]>;

export interface LogEvent {
  method: string;
  path: string;
  status: number;
  ms: number;
  timestamp: string;
}

export interface RouteDefinition {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  model: string;
}

export interface StatsResponse {
  models: Record<string, number>;
  totalRequests: number;
  uptime: number;
}
```

### 9.4 SSE Broadcaster

```typescript
// src/sse/broadcaster.ts
import type { Response } from 'express';
import type { LogEvent } from '../../shared/types.js';

const clients = new Set<Response>();

const broadcaster = {
  addClient(res: Response): void {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    clients.add(res);
    res.on('close', () => clients.delete(res));
  },

  emit(event: string, data: LogEvent): void {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    clients.forEach(client => client.write(payload));
  }
};

export default broadcaster;
```

### 9.5 React Dashboard — Live Log Component

```tsx
// dashboard/src/components/LiveLog.tsx
import { useEffect, useRef, useState } from 'react';
import type { LogEvent } from '../../../shared/types';

const MAX_LOGS = 200;

export default function LiveLog() {
  const [logs, setLogs] = useState<LogEvent[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const es = new EventSource('/api/_logs/stream');
    es.addEventListener('request', (e: MessageEvent) => {
      const entry: LogEvent = JSON.parse(e.data);
      setLogs(prev => [...prev.slice(-MAX_LOGS + 1), entry]);
    });
    return () => es.close();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const statusColor = (status: number): string =>
    status < 300 ? '#22c55e' : status < 400 ? '#eab308' : '#ef4444';

  return (
    <div className="live-log">
      {logs.map((log, i) => (
        <div key={i} className="log-entry">
          <span className="method">[{log.method}]</span>
          <span style={{ color: statusColor(log.status) }}>{log.status}</span>
          <span className="path">{log.path}</span>
          <span className="latency">{log.ms}ms</span>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
```

### 9.6 Core Backend Reference

```typescript
// src/seeder/typeMap.ts
import { faker } from '@faker-js/faker';

type Generator = () => unknown;

const TYPE_MAP: Record<string, Generator> = {
  id:          () => faker.string.uuid(),
  email:       () => faker.internet.email(),
  name:        () => faker.person.fullName(),
  firstName:   () => faker.person.firstName(),
  lastName:    () => faker.person.lastName(),
  title:       () => faker.lorem.sentence({ min: 3, max: 6 }),
  body:        () => faker.lorem.paragraphs(2),
  createdAt:   () => faker.date.recent(),
  updatedAt:   () => faker.date.recent(),
  // ... extend with full table from Section 6.1
};

const TYPE_FALLBACK: Record<string, Generator> = {
  string:  () => faker.lorem.word(),
  int:     () => faker.number.int({ min: 1, max: 1000 }),
  boolean: () => faker.datatype.boolean(),
  date:    () => faker.date.recent(),
  uuid:    () => faker.string.uuid(),
};

export function resolveGenerator(fieldName: string, fieldType: string): Generator {
  if (TYPE_MAP[fieldName]) return TYPE_MAP[fieldName];
  if (fieldName.endsWith('Id') || fieldName.endsWith('_id')) return () => faker.string.uuid();
  if (/^(is|has)[A-Z]/.test(fieldName)) return () => faker.datatype.boolean();
  return TYPE_FALLBACK[fieldType] ?? (() => faker.lorem.word());
}
```

```typescript
// src/server.ts
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseJsonSchema } from './parser/jsonParser.js';
import { seedModel } from './seeder/seeder.js';
import { createRoutes } from './router/routerFactory.js';
import store from './state/store.js';
import broadcaster from './sse/broadcaster.js';
import pluralize from 'pluralize';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface ServerOptions {
  seed?: number;
  port?: number;
  open?: boolean;
}

export async function startServer(schemaPath: string, options: ServerOptions = {}): Promise<void> {
  const models = parseJsonSchema(schemaPath);
  const seedCount = options.seed ?? 10;
  const port = options.port ?? 5000;

  // Seed
  const seededModels: Record<string, unknown[]> = {};
  for (const [modelName, fields] of Object.entries(models)) {
    const slug = pluralize(modelName.toLowerCase());
    seededModels[slug] = seedModel(modelName, fields, seedCount);
  }
  store.init(seededModels);

  const app = express();
  app.use(express.json());
  app.use((_req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    next();
  });

  // Mount mock API routes
  app.use('/api', createRoutes(models));

  // SSE log stream
  app.get('/api/_logs/stream', (req, res) => broadcaster.addClient(res));

  // Serve React dashboard (production build)
  const dashboardDist = path.join(__dirname, '../../dashboard/dist');
  app.use('/dashboard', express.static(dashboardDist));
  app.get('/dashboard/*', (_req, res) =>
    res.sendFile(path.join(dashboardDist, 'index.html'))
  );

  app.listen(port, () => {
    console.log(`\n  Mock API  →  http://localhost:${port}/api`);
    console.log(`  Dashboard →  http://localhost:${port}/dashboard\n`);
    if (options.open) {
      import('open').then(({ default: open }) => open(`http://localhost:${port}/dashboard`));
    }
  });
}
```

### 9.7 TypeScript Configuration

**Root `tsconfig.json`** (backend):

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": ".",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*", "bin/**/*", "shared/**/*"],
  "exclude": ["node_modules", "dist", "dashboard"]
}
```

**`dashboard/tsconfig.json`** (frontend — extends Vite react-ts defaults):

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "paths": {
      "../shared/*": ["../shared/*"]
    }
  },
  "include": ["src", "../shared"]
}
```

---

## 10. Glossary

| Term | Definition |
|---|---|
| Model | An entity definition describing a data shape (like a database table) |
| Slug | The URL-safe, pluralised, lowercased form of a model name (e.g., `users`) |
| Seeding | Generating an initial set of realistic fake records for a model |
| In-memory state | Server data held in a JavaScript object in RAM — lost on restart unless persisted |
| Relational seeding | Generating FK values that reference real IDs from related seeded models |
| Type-hint mapping | The lookup table mapping a field name or type to a Faker.js generator function |
| Reset | Wiping all mutated state and re-running the seeder to restore the initial baseline |
| SSE | Server-Sent Events — one-way real-time stream from server to browser client |
| Vite | Frontend build tool; handles bundling, HMR, and the dev proxy |
| concurrently | npm package for running multiple processes from a single command |
| tsx | Node.js TypeScript executor — runs `.ts` files directly without a compile step |
| Dashboard | The React SPA served at `/dashboard` for managing and monitoring MockForge |
| Single-command delivery | The requirement that `mockforge ./schema.json` starts both API and dashboard |
| shared/types.ts | The single source of truth for all TypeScript interfaces shared between backend and frontend |

---

*End of Document — MockForge SRS v1.3.0*
