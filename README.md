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

The repo has `render.yaml` at its root (Render's Blueprint auto-detection
requires it there) and `frontend/vercel.json`. Deploy backend first —
the frontend's `NEXT_PUBLIC_API_URL` needs the backend's live URL.

### 1. Backend → Render

1. [dashboard.render.com](https://dashboard.render.com) → **New +** →
   **Blueprint** → connect this GitHub repo. Render finds `render.yaml`
   automatically and proposes one free web service
   (`society-tracker-backend`, root directory `backend`).
2. Before the first deploy, it'll prompt for every env var marked
   `sync: false` in `render.yaml`. Fill in:
   - `DATABASE_URL` — your Neon connection string (the same one already
     in `backend/.env` locally — reuse it, don't create a new database).
   - `BETTER_AUTH_SECRET` — any random 32+ char string
     (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
     locally to generate one).
   - `BETTER_AUTH_URL` — leave a placeholder for now (e.g.
     `https://society-tracker-backend.onrender.com`); Render shows you
     the real assigned URL after the first deploy — come back and set
     this to match exactly, then redeploy.
   - `FRONTEND_URL` — same idea: placeholder now, the real Vercel URL
     once you have it (step 2), then redeploy.
   - `UPSTASH_REDIS_URL`, `R2_*`, `RESEND_*` — real values if you have
     accounts for them (see Setup above); otherwise the app still
     deploys and auth/complaints/notices work — only background jobs
     (overdue sweep, notification emails) and photo uploads stay inactive
     until these are real.
3. Deploy. First boot runs `prisma migrate deploy` against your Neon
   database automatically (via `startCommand` in `render.yaml`).

### 2. Frontend → Vercel

1. [vercel.com/new](https://vercel.com/new) → import the same repo.
2. In the import screen (or Project Settings → General afterward), set
   **Root Directory** to `frontend`.
3. Project Settings → Environment Variables:
   - `NEXT_PUBLIC_API_URL` — the Render backend URL from step 1 (no
     trailing slash).
   - `NEXT_PUBLIC_R2_PUBLIC_BASE_URL` — your R2 public bucket URL, or
     leave any placeholder if you don't have R2 set up yet (photo links
     just won't resolve).
4. Deploy.

### 3. Close the loop

Go back to Render → your backend service → Environment, set
`BETTER_AUTH_URL` to the backend's own real Render URL and `FRONTEND_URL`
to the real Vercel URL from step 2, then trigger a redeploy. This matters
because the frontend and backend are on different domains in production,
so Better-Auth's session cookie needs `SameSite=None; Secure` — which its
defaults only produce correctly once `baseURL`/`trustedOrigins` match the
real deployed URLs, not placeholders.

### 4. Seed the deployed database (optional, for demo accounts)

From your machine, with `backend/.env`'s `DATABASE_URL` pointed at the
same Neon database Render is using: `cd backend && npm run seed`. Prisma
migrations already ran automatically on Render's first deploy (step 1),
so this just adds the demo societies/accounts on top.

## API

Base path `/api/v1`. Every list endpoint is cursor-paginated
(`?cursor=&limit=`, response `{ items, nextCursor }`) — never
offset/page-number. POST/PATCH endpoints accept an `Idempotency-Key`
header; a repeated key within 24h returns the original response instead
of re-running the request.

| Endpoint | Notes |
|---|---|
| `POST/GET /auth/*` | Better-Auth (sign-up, sign-in, session, sign-out, update-user) |
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

Full request/response payloads, status codes, and error shapes for every
endpoint above: **[API.md](./API.md)**.

## Verification status

Postgres/Prisma/Better-Auth/Fastify/RBAC were live-tested against a real
Neon database during development — not just compiled. That round of
testing found and fixed a chain of real bugs (a boot-order deadlock under
a Redis outage, a 404'ing auth mount, a privilege-escalation hole, and a
fundamental mismatch between the spec's literal `User.password_hash`
field and how Better-Auth actually stores credentials — see
`documentation.txt` Step 13 for the full account). Confirmed working via
curl against live infrastructure: sign-up with an invite code, sign-in,
RBAC 403s, the privilege-escalation guard, complaint creation (including
graceful degradation when Redis is unreachable), and notices/complaints
listing.

**Still not live-tested**: Upstash Redis, Cloudflare R2, and Resend all
still need real accounts provisioned (see Setup above) — BullMQ job
processing, R2 uploads, and actual email sends are code-reviewed and
typechecked but not yet run against real infrastructure. The frontend UI
has been visually checked in a browser but not exercised through a full
signup→complaint→resolution flow with real R2/Resend behind it.

## Assumptions made

Recorded inline in `documentation.txt` as they were made; the notable ones:

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
- **`User.password_hash` does not exist** (the one real deviation from
  the spec's literal data model, and not optional — see below).

## Better-Auth's data model vs. the spec's literal one

The spec's `User` field list includes `password_hash` directly on the
table. That cannot work with Better-Auth as actually implemented: its
sign-up/sign-in code always reads and writes the credential via a
separate `Account` row (`providerId: "credential"`), never a column on
`User`, regardless of what the Prisma schema declares — confirmed by
hitting this exact wall live (see `documentation.txt` Step 13) and by
generating a reference schema with `npx @better-auth/cli generate`
pointed at this app's real `auth.ts`. The schema therefore has no
`User.password_hash`; instead it adds three Better-Auth-owned tables
(`Session`, `Account`, `Verification`) plus `User.emailVerified` and
`User.updatedAt`, which Better-Auth's internal adapter unconditionally
includes on every user write. Every other field on `User` matches the
spec exactly.

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
