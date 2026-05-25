# MockForge

Schema-driven mock REST APIs, realistic seed data, and a live developer dashboard from one command.

MockForge turns a simple JSON schema into a local API that frontend, mobile, QA, and product teams can develop against immediately. It includes generated CRUD routes, deterministic fake data, live request logs, snapshots, chaos testing, fake auth, exports, and a dark browser dashboard served by the same Express process.

## Features

- Generate REST CRUD endpoints from a JSON schema
- Seed realistic data with Faker
- Preserve in-memory mutations during the server session
- Reload schemas without restarting
- Live request log over Server-Sent Events
- Dashboard at `/dashboard`
- Latency simulation, random error injection, fake auth, and rate limiting
- Named snapshots and per-model reset
- Mutation history and request inspector
- Search, sort, pagination, field selection, and nested relation routes
- Fixture imports for real sample data
- Deterministic seeding with `--seed-key`
- TypeScript, Postman, and MSW exports
- OpenAPI export for Swagger and client generators
- Schema file watch mode enabled by default

## Quick Start

Install dependencies:

```bash
npm install
npm --prefix dashboard install
```

Build the backend and dashboard:

```bash
npm run build
```

Start MockForge:

```bash
npm start -- schema.json
```

Open the dashboard:

```text
http://localhost:5000/dashboard/
```

The API is served from:

```text
http://localhost:5000/api
```

## Example Schema

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

This creates routes such as:

```text
GET    /api/users
GET    /api/users/:id
POST   /api/users
PUT    /api/users/:id
PATCH  /api/users/:id
DELETE /api/users/:id

GET    /api/posts
GET    /api/users/:id/posts
```

## CLI Options

```bash
mockforge [schema] [options]
```

| Option | Description |
|---|---|
| `-p, --port <port>` | Preferred port. Defaults to `5000`; MockForge tries up to `5010` if occupied. |
| `-s, --seed <count>` | Records to generate per model. Defaults to `10`. |
| `--seed-key <key>` | Deterministic Faker seed for reproducible data. |
| `--delay <ms>` | Global response delay in milliseconds. |
| `--chaos <rate>` | Random 500 error rate from `0` to `1`, e.g. `0.1`. |
| `--rate-limit <count>` | Requests per minute before returning `429`. |
| `--auth` | Require `Authorization: Bearer <token>` on model API routes. |
| `--token <token>` | Fake auth token. Defaults to `mockforge-dev-token`. |
| `--fixtures <path>` | Load fixture data from a JSON file. |
| `--no-watch` | Disable automatic schema reload on file changes. |
| `--open` | Open the dashboard after startup. |

Example:

```bash
npm start -- schema.json --seed-key 42 --delay 200 --chaos 0.1 --auth --token dev-token --open
```

## REST API

For each model, MockForge exposes:

```text
GET    /api/:model
GET    /api/:model/:id
POST   /api/:model
PUT    /api/:model/:id
PATCH  /api/:model/:id
DELETE /api/:model/:id
```

List endpoints support:

| Query | Example |
|---|---|
| Pagination | `/api/users?_page=2&_limit=10` |
| Field filtering | `/api/users?role=admin` |
| Full-text search | `/api/users?_search=john` |
| Sorting | `/api/users?_sort=createdAt&_order=desc` |
| Field selection | `/api/users?_fields=id,name,email` |

Nested relation routes are inferred from fields such as `userId`:

```text
GET /api/users/:id/posts
```

## Control Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/_stats` | Model counts, request count, uptime, and port |
| `GET` | `/api/_routes` | Active route definitions |
| `GET` | `/api/_schema` | Current parsed schema |
| `GET` | `/api/_project` | Export schema, data, snapshots, and runtime settings |
| `POST` | `/api/_project/import` | Import a full project config bundle |
| `POST` | `/api/_schema/reload` | Reload schema at runtime |
| `POST` | `/api/reset` | Reset all models to baseline seed data |
| `POST` | `/api/reset/:model` | Reset one model |
| `GET` | `/api/_logs/stream` | SSE request log stream |
| `GET` | `/api/_config` | Runtime simulation config |
| `POST` | `/api/_config` | Update delay, chaos, auth, and rate limit config |
| `GET` | `/api/_snapshots` | List saved snapshots |
| `POST` | `/api/_snapshots/:name` | Save current state as a named snapshot |
| `POST` | `/api/_snapshots/:name/restore` | Restore a snapshot |
| `GET` | `/api/_history` | Mutation history with before/after payloads |
| `GET` | `/api/_requests` | Recent request inspector payloads |
| `GET` | `/api/_types` | TypeScript interfaces for all models |
| `GET` | `/api/_export/openapi.json` | OpenAPI 3.1 spec export |
| `GET` | `/api/_export/postman` | Postman collection export |
| `GET` | `/api/_export/msw` | MSW handler export |

## Runtime Simulation

Set global simulation from the CLI:

```bash
npm start -- schema.json --delay 300 --chaos 0.05 --rate-limit 60
```

Or update it while the server is running:

```bash
curl -X POST http://localhost:5000/api/_config \
  -H "Content-Type: application/json" \
  -d '{"globalDelayMs":200,"chaosRate":0.1,"rateLimitPerMinute":100}'
```

Require fake auth:

```bash
npm start -- schema.json --auth --token dev-token
```

Then call model routes with:

```bash
curl http://localhost:5000/api/users \
  -H "Authorization: Bearer dev-token"
```

## Fixtures

Use fixture data instead of generated records:

```bash
npm start -- schema.json --fixtures seed-data.json
```

Fixture files are keyed by route model name:

```json
{
  "users": [
    {
      "id": "user-1",
      "name": "Ada Lovelace",
      "email": "ada@example.test"
    }
  ],
  "posts": [
    {
      "id": "post-1",
      "title": "Hello MockForge",
      "body": "Seeded from fixtures.",
      "userId": "user-1"
    }
  ]
}
```

## Dashboard

The dashboard is a React/Vite app served by Express at:

```text
/dashboard
```

It includes:

- Route explorer with copyable curl examples
- Live request log
- Schema editor and runtime reload
- Data explorer
- Simulation controls
- Snapshot save/restore
- Per-model reset
- TypeScript, Postman, and MSW export previews
- Relationship graph
- Mutation history timeline
- Request inspector

## Development

Run backend and dashboard in development mode:

```bash
npm run dev
```

Build everything:

```bash
npm run build
```

Run the compiled CLI:

```bash
npm start -- schema.json
```

## Project Structure

```text
bin/                 CLI entry point
src/                 Express API, parser, seeder, router, state, middleware
shared/              Shared TypeScript interfaces
dashboard/           React/Vite dashboard
schema.json          Example schema
```

## Status

MockForge is an early local-first developer tool. It is designed for local development and testing, not production hosting or security-sensitive environments.
