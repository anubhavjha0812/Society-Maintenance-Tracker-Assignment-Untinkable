# Society Maintenance Tracker

Phase 0 MVP: complaints, notices, and a per-society dashboard for
residential societies — multi-tenant, free-tier-hosted, built with
production-correct patterns (tenant scoping, append-only history, cursor
pagination, async jobs, direct-to-storage uploads) so the expensive things
don't need retrofitting later. See `SYSTEM_DESIGN.md` for the reasoning
behind each simplification, and `documentation.txt` for a full build log.

## Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 14 (App Router) + TypeScript + Tailwind |
| Backend | Node.js + TypeScript + Fastify 5 |
| Database | PostgreSQL via Neon + Prisma |
| Auth | Better-Auth (email/password, invite-code registration) |
| Object storage | Cloudflare R2 (pre-signed direct upload) |
| Cache/Queue | Upstash Redis + BullMQ (worker runs in-process) |
| Email | Resend |
| Hosting | Vercel (frontend), Render (backend) |

## Repo layout

```
/backend    Fastify API + Prisma schema + BullMQ workers (in-process)
/frontend   Next.js app (resident + admin views)
SYSTEM_DESIGN.md    architecture notes, what's simplified and why
documentation.txt   step-by-step build log and decisions
commands.txt        every command run during the build, one line each
```

## Setup

### 1. Provision free-tier services

- **Neon** (neon.tech) — create a project, copy the pooled connection
  string.
- **Upstash** (upstash.com) — create a Redis database, copy the **TCP**
  connection string (`rediss://...`), not the REST URL — BullMQ needs a
  real Redis protocol connection.
- **Cloudflare R2** (dash.cloudflare.com → R2) — create a bucket, an API
  token (Account ID + Access Key ID + Secret Access Key), and enable
  public access (or a custom domain) for the bucket to get a public base
  URL.
- **Resend** (resend.com) — create an API key and verify a sending
  domain (or use their sandbox sender for testing).

### 2. Backend

```bash
cd backend
cp .env.example .env   # fill in the values from step 1
npm install
npm run prisma:migrate   # creates tables on your Neon database
npm run seed              # 3 demo societies, admins, residents, sample complaints/notices
npm run dev                # http://localhost:4000
```

### 3. Frontend

```bash
cd frontend
cp .env.example .env.local
# NEXT_PUBLIC_API_URL=http://localhost:4000
# NEXT_PUBLIC_R2_PUBLIC_BASE_URL=<same value as backend's R2_PUBLIC_BASE_URL>
npm install
npm run dev   # http://localhost:3000
```

After seeding, sign in at `/login` with any of the emails the seed script
prints (all use password `Password123!`), or register a new resident at
`/register` using one of the printed invite codes.

## Deployment

- **Backend → Render**: point a Blueprint at `backend/render.yaml` (or
  create a Web Service manually with root directory `backend`, build
  command `npm install && npm run prisma:generate && npm run build`,
  start command `npm run prisma:deploy && npm start`). Set every env var
  from `backend/.env.example` in the Render dashboard.
- **Frontend → Vercel**: import the repo, set **Root Directory** to
  `frontend`, and set `NEXT_PUBLIC_API_URL` / `NEXT_PUBLIC_R2_PUBLIC_BASE_URL`
  in Project Settings → Environment Variables.
- Set `BETTER_AUTH_URL` (backend) and `FRONTEND_URL` (backend) to your
  real deployed URLs so cookies/CORS work — the frontend and backend are
  on different domains in production, so Better-Auth's session cookie
  needs `SameSite=None; Secure`, which its defaults already produce over
  HTTPS.

## API

Base path `/api/v1`. Every list endpoint is cursor-paginated
(`?cursor=&limit=`, response `{ items, nextCursor }`) — never
offset/page-number. POST/PATCH endpoints accept an `Idempotency-Key`
header; a repeated key within 24h returns the original response instead
of re-running the request.

| Endpoint | Notes |
|---|---|
| `POST/GET /auth/*` | Better-Auth (sign-up, sign-in, session, sign-out) |
| `POST /complaints` | resident creates |
| `GET /complaints/mine` | resident's own, cursor-paginated |
| `GET /complaints` | admin, filter by category/status/priority/date range, sorted overdue → priority → age |
| `GET /complaints/:id` | single complaint (not in the original spec's endpoint list — added; see documentation.txt Step 3) |
| `GET /complaints/:id/history` | append-only status history |
| `PATCH /complaints/:id/status` | admin; `{ status: "InProgress"\|"Resolved"\|"Reopened", note? }` |
| `PATCH /complaints/:id/priority` | admin; `{ priority: "Low"\|"Medium"\|"High" }` |
| `POST /media/presign` / `POST /media/confirm` | R2 direct-upload flow |
| `POST /notices`, `GET /notices` | admin create, cursor-paginated list, important-pinned-first |
| `GET /dashboard/summary` | admin; 60s Redis-cached counts |

## Assumptions made (no live testing performed)

This was built without provisioning real Neon/Upstash/R2/Resend accounts,
so nothing here has been smoke-tested end-to-end against live services —
verification so far is `prisma validate`, `npm run typecheck`, and a
production `next build`, all passing on both apps. Notable assumptions,
also recorded inline in `documentation.txt`:

- Registration uses a per-society invite code (Society.invite_code) —
  the spec allowed either an invite-code or society-selection flow.
- Complaint categories are a fixed list (`frontend/lib/categories.ts`) —
  not specified by the spec.
- Overdue sweep runs every 5 minutes (spec said "every few minutes"
  without a number).
- Photo uploads: jpeg/png/webp/heic only, 10MB max — not specified.
- `Society.invite_code` and `NotificationLog.idempotency_key` were added
  to the Prisma schema beyond the spec's literal field list, both
  required by the spec's own functional requirements (invite-code
  registration; idempotent notification sends).

## Dependency notes

- Fastify was upgraded from the spec's implied v4 to **v5** after
  `npm audit` found 2 high-severity DoS/validation-bypass advisories in
  v4 with no fix short of the major bump; `@fastify/cors`/`@fastify/rate-limit`
  were bumped to their v5-compatible releases alongside it. 0 vulnerabilities
  remain in the backend.
- Next.js is pinned to the latest **14.2.x** patch release rather than
  jumped to v16 — `npm audit` still lists several advisories against the
  14.x line, but each is scoped to Server Actions, Middleware, the Image
  Optimizer, or a custom server, none of which this app uses (no
  `next/image`, no `middleware.ts`, no Server Actions, no custom server).
  Jumping two majors to clear an audit warning for unused surface area
  wasn't judged worth contradicting the spec's explicit "Next.js 14" and
  the App Router API changes that would come with it.

## Deferred from the full billion-user design (and why)

- **Kafka** — a single Redis-backed BullMQ queue is enough for MVP job
  volume (overdue sweeps, notification fan-out). Kafka earns its
  complexity once notification fan-out needs many independent consumer
  groups at real horizontal scale.
- **Database sharding** — one Neon Postgres instance comfortably holds
  many societies' data behind `society_id` scoping. Sharding (e.g. by
  `society_id` hash) only pays off once a single primary can't take the
  write volume.
- **Microservices split** — the backend is one Fastify app with
  module-per-domain folders (`modules/complaints`, `modules/notices`,
  ...) specifically so each module could become its own service later
  without a rewrite — not worth the operational overhead at MVP scale.
- **Multi-region** — a single Neon region + single Render region is
  fine until latency to a specific geography becomes a real complaint;
  premature multi-region adds failover/replication complexity with no
  MVP payoff.
- **Standalone background worker** — BullMQ's worker runs in-process
  with the API (see `SYSTEM_DESIGN.md`'s "Notification flow" section)
  because Render's free tier has no background-worker product; splitting
  it out is a config change, not a rewrite, once traffic justifies the
  paid tier.
