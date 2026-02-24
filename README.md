# Phork

Phork is a closed-loop AI production studio where every asset (video, audio, image) is generated on-platform. Users compose shots into timeline-based projects, render final outputs via FFmpeg, and fork each other's work with full provenance tracking. No external uploads are allowed -- the entire creative pipeline lives inside Phork.

## Architecture Overview

### Monorepo Structure

```
phork/
├── apps/
│   ├── web/             # Next.js 15 frontend (port 3000)
│   └── api/             # Fastify 5 REST API + BullMQ workers (port 3001)
├── packages/
│   ├── db/              # Drizzle ORM schema + migrations (PostgreSQL)
│   └── shared/          # TypeScript types, enums, interfaces
├── docker-compose.yml   # PostgreSQL 16 + Redis 7
├── turbo.json           # Turborepo task pipeline
└── pnpm-workspace.yaml
```

### Tech Stack

| Layer          | Technology                        | Version |
| -------------- | --------------------------------- | ------- |
| Frontend       | Next.js (App Router) + React      | 15 / 19 |
| UI Styling     | Tailwind CSS                      | 4       |
| State          | Zustand                           | 5       |
| API            | Fastify                           | 5       |
| Auth           | @fastify/jwt (JWT Bearer tokens)  | 9       |
| Database       | PostgreSQL                        | 16      |
| ORM            | Drizzle ORM + drizzle-kit         | 0.38    |
| Queue          | BullMQ (Redis-backed)             | 5       |
| Cache / Queue  | Redis                             | 7       |
| Media          | FFmpeg (generation stubs + render) | --      |
| Monorepo       | pnpm workspaces + Turborepo       | 2       |
| Language       | TypeScript                        | 5.7     |

## Prerequisites

Install these before starting:

| Tool     | Minimum Version | Install                                        |
| -------- | --------------- | ---------------------------------------------- |
| Node.js  | 20+             | https://nodejs.org                             |
| pnpm     | 9+              | `npm install -g pnpm`                          |
| Docker   | 24+             | https://docs.docker.com/get-docker/            |
| FFmpeg   | 6+              | https://ffmpeg.org/download.html (must be on PATH) |

Verify:

```bash
node -v        # v20+
pnpm -v        # 9+
docker -v      # 24+
ffmpeg -version # 6+
```

## Quick Start

```bash
# 1. Clone the repository
git clone <repo-url> phork
cd phork

# 2. Install dependencies
pnpm install

# 3. Copy environment file
cp .env.example .env

# 4. Start PostgreSQL 16 + Redis 7
docker-compose up -d

# 5. Push database schema to PostgreSQL
pnpm db:push

# 6. Seed test data (test user + sample project)
cd apps/api && npx tsx src/scripts/seed.ts && cd ../..

# 7. Start the API server (Terminal 1)
pnpm --filter @phork/api dev

# 8. Start the BullMQ workers (Terminal 2)
pnpm --filter @phork/api dev:worker

# 9. Start the Next.js frontend (Terminal 3)
pnpm --filter @phork/web dev
```

After startup:

| Service      | URL                          |
| ------------ | ---------------------------- |
| Frontend     | http://localhost:3000         |
| API          | http://localhost:3001         |
| Health check | http://localhost:3001/health  |

**Test user credentials** (after seeding): `test@phork.ai` / `testpass123`

The seed script creates a workspace with 5000 credits, a "Demo: Space Adventure" project with 3 video shots, and proper provenance records.

## Environment Variables

Create a `.env` file in the project root (or copy `.env.example`):

| Variable              | Default                                           | Description                                                      |
| --------------------- | ------------------------------------------------- | ---------------------------------------------------------------- |
| `DATABASE_URL`        | `postgresql://phork:phork@localhost:5432/phork`    | PostgreSQL connection string                                     |
| `REDIS_URL`           | `redis://localhost:6379`                           | Redis connection string (used by BullMQ)                         |
| `JWT_SECRET`          | `change-me-in-production`                          | Secret for signing JWT auth tokens                               |
| `ASSET_STORAGE_PATH`  | `./storage`                                        | Local filesystem path for generated asset files                  |
| `ASSET_STORAGE_BUCKET`| `phork-assets`                                     | S3 bucket name (unused in Phase 1, reserved for cloud storage)   |
| `MINT_RECEIPT_SECRET` | `change-me-mint-secret`                            | HMAC secret for signing mint receipts on generated assets        |

## Available Scripts

### Root (Turborepo)

| Command             | Description                                         |
| ------------------- | --------------------------------------------------- |
| `pnpm dev`          | Start all apps in dev mode (API + Web)               |
| `pnpm build`        | Build all packages and apps                          |
| `pnpm lint`         | Type-check all packages and apps                     |
| `pnpm db:generate`  | Generate Drizzle migration files from schema changes |
| `pnpm db:migrate`   | Run pending Drizzle migrations                       |
| `pnpm db:push`      | Push schema directly to the database (no migration files) |

### API (`apps/api`)

| Command                                | Description                          |
| -------------------------------------- | ------------------------------------ |
| `pnpm --filter @phork/api dev`         | Start API server with hot reload     |
| `pnpm --filter @phork/api dev:worker`  | Start BullMQ workers with hot reload |
| `pnpm --filter @phork/api build`       | Compile TypeScript to `dist/`        |
| `pnpm --filter @phork/api start`       | Run compiled API server              |
| `pnpm --filter @phork/api start:worker`| Run compiled workers                 |

### Web (`apps/web`)

| Command                             | Description                     |
| ----------------------------------- | ------------------------------- |
| `pnpm --filter @phork/web dev`      | Start Next.js dev server (3000) |
| `pnpm --filter @phork/web build`    | Production build                |
| `pnpm --filter @phork/web start`    | Start production server         |
| `pnpm --filter @phork/web lint`     | Run Next.js lint                |

### Utility Scripts

| Command                                                  | Description                              |
| -------------------------------------------------------- | ---------------------------------------- |
| `cd apps/api && npx tsx src/scripts/seed.ts`             | Seed the database with test data         |
| `cd apps/api && npx tsx src/scripts/test-flows.ts`       | Run the integration test suite           |
| `node scripts/generate-report.mjs`                       | Generate PDF progress report (requires Chrome + running frontend) |

## Running Tests

The integration test suite lives at `apps/api/src/scripts/test-flows.ts`. It requires the API server to be running on `localhost:3001`.

```bash
# 1. Ensure Docker services, API server, and workers are running (see Quick Start steps 4-8)

# 2. Run the test suite
cd apps/api && npx tsx src/scripts/test-flows.ts
```

The suite runs 8 sequential tests:

| #  | Test                     | What it verifies                                            |
| -- | ------------------------ | ----------------------------------------------------------- |
| 1  | Health Check             | `GET /health` returns 200 with `status: ok`                 |
| 2  | Registration & Auth      | Register, login, and `GET /auth/me` work correctly          |
| 3  | Closed Ecosystem         | Commit with a fake (non-minted) asset ID is rejected (400)  |
| 4  | Project & Commits        | Create project, create commits, list commits                |
| 5  | Credits System           | Starter balance is 1000, ledger endpoint works              |
| 6  | Job Idempotency          | Duplicate job key returns same ID; credits debited only once|
| 7  | Forking                  | Fork preserves history, divergent commits are allowed       |
| 8  | Job List & Status        | List jobs by project, get individual job by ID              |

All tests pass against a freshly seeded or clean database.

## Project Structure

```
phork/
├── apps/
│   ├── api/
│   │   ├── src/
│   │   │   ├── server.ts              # Fastify entry point
│   │   │   ├── config.ts              # Environment config
│   │   │   ├── worker.ts              # BullMQ worker entry point
│   │   │   ├── routes/
│   │   │   │   ├── auth.ts            # POST /auth/register, /login, GET /auth/me
│   │   │   │   ├── projects.ts        # CRUD projects, commits, fork
│   │   │   │   ├── jobs.ts            # gen-video, gen-audio, render
│   │   │   │   ├── credits.ts         # Balance + ledger queries
│   │   │   │   └── assets.ts          # Asset metadata + signed file streaming
│   │   │   ├── workers/
│   │   │   │   ├── index.ts           # Worker registration (generation + render)
│   │   │   │   ├── generation.ts      # gen_video, gen_audio, gen_image stubs
│   │   │   │   ├── render.ts          # FFmpeg concat render pipeline
│   │   │   │   └── safety.ts          # Keyword-based content policy checks
│   │   │   ├── lib/
│   │   │   │   ├── queue.ts           # BullMQ queue definitions
│   │   │   │   ├── mint.ts            # HMAC-SHA256 mint receipt signing
│   │   │   │   ├── storage.ts         # Asset file storage + signed URLs
│   │   │   │   └── refund.ts          # Credit refund for failed/blocked jobs
│   │   │   └── scripts/
│   │   │       ├── seed.ts            # Database seeder
│   │   │       └── test-flows.ts      # Integration test suite
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── web/
│       ├── src/
│       │   ├── app/
│       │   │   ├── layout.tsx         # Root layout
│       │   │   ├── page.tsx           # Landing / redirect
│       │   │   ├── globals.css        # Tailwind global styles
│       │   │   ├── login/page.tsx     # Login / Register page
│       │   │   └── studio/page.tsx    # Studio dashboard + project editor
│       │   ├── components/
│       │   │   ├── ShotList.tsx        # Timeline shot list panel
│       │   │   ├── ShotEditor.tsx      # Shot editing panel (prompt, audio, duration)
│       │   │   ├── ProvenancePanel.tsx  # Asset provenance viewer
│       │   │   └── ForkDialog.tsx      # Project fork dialog
│       │   ├── stores/
│       │   │   ├── auth.ts            # Zustand auth store
│       │   │   └── project.ts         # Zustand project/timeline store
│       │   └── lib/
│       │       └── api.ts             # API client helpers
│       ├── next.config.ts
│       ├── postcss.config.mjs
│       ├── package.json
│       └── tsconfig.json
├── packages/
│   ├── db/
│   │   ├── src/
│   │   │   ├── schema.ts             # Drizzle table definitions (11 tables)
│   │   │   └── index.ts              # DB client factory + schema re-exports
│   │   ├── drizzle/                   # Generated migrations
│   │   ├── drizzle.config.ts
│   │   └── package.json
│   └── shared/
│       ├── src/
│       │   ├── types.ts              # Shared TypeScript types + interfaces
│       │   └── index.ts              # Re-exports
│       └── package.json
├── storage/                           # Generated asset files (gitignored)
├── scripts/
│   └── generate-report.mjs           # PDF report generator (Puppeteer)
├── docker-compose.yml                 # PostgreSQL 16 + Redis 7
├── turbo.json
├── pnpm-workspace.yaml
├── tsconfig.json                      # Base TypeScript config
└── package.json                       # Root workspace scripts
```

## API Endpoints

All endpoints except auth and file streaming require a `Bearer <token>` header.

| Method | Endpoint                      | Auth   | Description                                      |
| ------ | ----------------------------- | ------ | ------------------------------------------------ |
| GET    | `/health`                     | No     | Health check (`{ status: "ok" }`)                |
| POST   | `/auth/register`              | No     | Register user + create workspace + 1000 credits  |
| POST   | `/auth/login`                 | No     | Login, returns JWT                               |
| GET    | `/auth/me`                    | Yes    | Current user + workspace memberships             |
| POST   | `/projects`                   | Yes    | Create project with initial empty commit         |
| GET    | `/projects?workspaceId=`      | Yes    | List projects in workspace                       |
| GET    | `/projects/:id`               | Yes    | Get project + head commit                        |
| POST   | `/projects/:id/commits`       | Yes    | Create commit (validates all asset mint receipts)|
| GET    | `/projects/:id/commits`       | Yes    | List commits for project                         |
| GET    | `/projects/:id/commits/:cid`  | Yes    | Get specific commit                              |
| POST   | `/projects/:id/fork`          | Yes    | Fork project from a specific commit              |
| POST   | `/jobs/gen-video`             | Yes    | Queue video generation (25 credits)              |
| POST   | `/jobs/gen-audio`             | Yes    | Queue TTS audio generation (5 credits)           |
| POST   | `/jobs/render`                | Yes    | Queue render from commit (15 credits)            |
| GET    | `/jobs/:id`                   | Yes    | Get job status + result                          |
| GET    | `/jobs?projectId=`            | Yes    | List jobs for project                            |
| GET    | `/credits/balance?workspaceId=` | Yes  | Workspace credit balance                         |
| GET    | `/credits/ledger?workspaceId=`  | Yes  | Immutable credit ledger entries                  |
| GET    | `/assets/:id`                 | Yes    | Asset metadata + signed download URL             |
| GET    | `/assets/:id/file?token=&expires=` | No* | Stream asset binary via signed URL          |

\* File streaming uses time-limited signed URLs instead of JWT auth so that HTML media elements can fetch directly.

## Key Design Decisions

### Closed Ecosystem

No external file uploads exist. Every asset must be created by an on-platform generation job, which produces an HMAC-SHA256 mint receipt (`mint_receipt_sig`). When a commit is created, the API validates that every referenced asset ID exists in the database and carries a valid mint receipt. Attempting to reference a non-existent or un-minted asset returns HTTP 400.

### Signed URLs

Asset file streaming (`/assets/:id/file`) is protected by time-limited, HMAC-signed URL tokens rather than JWT auth. This allows HTML `<video>` and `<audio>` elements to fetch media directly without custom auth headers. Tokens are generated server-side via `GET /assets/:id` (which requires JWT auth + workspace membership) and expire after 15 minutes.

**Multi-user alpha posture: "shareable but short-lived."** The signed URL does not include userId or workspaceId in the HMAC input, so a URL can technically be shared with anyone who obtains it. This is accepted for internal alpha because: (a) tokens expire in 15 minutes, (b) obtaining the URL requires JWT auth + workspace membership verification, (c) all assets are AI-generated content (not user-uploaded PII), and (d) all asset access is logged via the provenance chain. If "no sharing" becomes a requirement for external beta, the file endpoint (`/assets/:id/file`) must be upgraded to authenticated fetch (cookie/session-based) with a membership check on every request.

### Idempotency

Every job requires a unique `idempotency_key` (enforced by a database unique constraint). If a client retries a request with the same key, the API returns the existing job without creating a duplicate or debiting credits a second time. This prevents double-charging on network retries.

### Refund Policy

Jobs that fail during processing or are blocked by the safety policy receive an automatic full credit refund. The refund is recorded as a positive entry in the credit ledger with a descriptive reason.

### Fork Model

Forking creates a new project with `parent_project_id` and `forked_from_commit_id` references. The commit chain is walked backwards from the fork point and re-created with new IDs in the new project. Asset references are shared (not duplicated). After forking, the new project can diverge independently with its own commits.
