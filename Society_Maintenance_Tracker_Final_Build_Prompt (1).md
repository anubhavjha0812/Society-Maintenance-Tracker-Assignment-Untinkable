# Society Maintenance Tracker — Final Build Prompt for Claude Code
### Scalable MVP | 100% Free-Tier Stack

You are building **Phase 0** of a multi-tenant Society Maintenance Tracker. This MVP must be fully functional and deployable today at zero cost, but its **data model, API contracts, and core patterns must already be correct for a platform that will eventually scale to millions of tenants and a billion users.** Do not build heavy infra (no Kafka, no DB sharding, no microservices split, no multi-region) — but do not cut corners on the things that are expensive to retrofit later (tenant scoping, append-only history, async jobs, direct-to-storage uploads).

---

## Tech Stack (all free tier)

| Layer | Choice | Why |
|---|---|---|
| Frontend | **Next.js 14 (App Router) + TypeScript + Tailwind CSS** | SSR, file-based routing, best-in-class Vercel deploy |
| Backend | **Node.js + TypeScript + Fastify** | Higher throughput than Express, built-in schema validation, plugin architecture maps to future microservices |
| Database | **PostgreSQL via Neon (serverless) + Prisma ORM** | Auto connection pooling, branching, generous free tier |
| Auth | **Better-Auth** | Self-hosted, open-source, TypeScript-native, multi-tenant/RBAC-friendly, no per-user pricing |
| Object storage | **Cloudflare R2** | S3-compatible API, zero egress fees (critical at scale) |
| Cache/Queue | **Upstash Redis + BullMQ** | Serverless Redis, pay-per-request, free tier covers MVP job volume |
| Email | **Resend** | React-based email templates, strong deliverability, generous free tier |
| Frontend hosting | **Vercel** | Free for personal projects, edge network, zero-config Next.js deploy |
| Backend hosting | **Render** | Free web service tier; see note below on the BullMQ worker |

> **Render free-tier note:** Render's free tier only covers web services (sleeps after 15 min inactivity, ~30-50s cold start on wake). It has **no free tier for a standalone background worker** — that requires a paid Background Worker instance (~$7/mo). For a true $0 MVP, run the BullMQ worker **inside the same Fastify process** as the API (started on boot, not a separate deploy) — see Build Order step 4 below. This means queued jobs (overdue sweep, notification sends) only get processed when the service is awake/receiving traffic, which is an acceptable MVP tradeoff. Document this clearly in the README as a scaling note: move to a dedicated paid Background Worker (or Fly.io) once real usage requires jobs to run reliably while the API is idle.

---

## Multi-Tenancy — Non-Negotiable Foundation
- Every table (`User`, `Complaint`, `ComplaintPhoto`, `ComplaintStatusHistory`, `Notice`, `NotificationLog`) has a `society_id` column, even though Phase 0 might only ever have a handful of societies
- No endpoint ever accepts `society_id` as a client-supplied filter — it is always derived from the authenticated user's session/JWT, so cross-tenant data leakage is impossible by construction
- Every query for complaints/notices/users is implicitly scoped to the authenticated user's `society_id`

## Data Model (Prisma schema — implement exactly this)
- `Society` (id, name, overdue_threshold_days default 7, created_at)
- `User` (id, society_id, name, email, phone, password_hash, role enum[resident, society_admin, super_admin], flat_number, created_at) — unique on (society_id, email)
- `Complaint` (id, society_id, resident_id, category, description, priority enum[Low,Medium,High] default Medium, current_status enum[Open,InProgress,Resolved] default Open, is_overdue boolean default false, created_at, updated_at)
- `ComplaintPhoto` (id, complaint_id, object_storage_key, content_type, size_bytes, created_at)
- `ComplaintStatusHistory` (id, complaint_id, society_id, status enum[Open,InProgress,Resolved,Reopened], note nullable, actor_id, timestamp) — **append-only; code must never issue an UPDATE or DELETE against this table**
- `Notice` (id, society_id, title, body, is_important boolean default false, posted_by, created_at)
- `NotificationLog` (id, society_id, user_id, channel enum[email], event_type, status enum[queued,sent,failed], provider_message_id nullable, created_at)

---

## Functional Requirements

### Auth (Better-Auth)
- Resident registration/login, scoped to a society (seed 2–3 demo societies; a society-selection or invite-code flow is fine for MVP)
- Admin login (seed one admin per demo society)
- Middleware enforcing role + society scoping on every protected route

### Complaints
- Resident: create complaint (category, description, optional photo via pre-signed R2 upload flow), view own complaints with full status history
- Admin: view all complaints for their society; filter by category, status, priority, date range using **cursor-based pagination** (never offset/page-number)
- Admin: set priority (Low/Medium/High)
- Admin: update status (Open → In Progress → Resolved); every change writes a new row to `ComplaintStatusHistory` with actor + optional note; never overwrite, only append
- Resolved complaints are closed; add an explicit "Reopen" action (writes a `Reopened` history row) rather than allowing silent edits after resolution
- Overdue detection: a scheduled BullMQ job (runs every few minutes) checks each society's `overdue_threshold_days` and sets `is_overdue = true` on qualifying complaints — never compute overdue status inline on every read
- Overdue complaints sort to the top of the admin list (overdue → priority → age)

### Notices
- Admin creates notices, optional `is_important` flag
- Important notices pin to top; list is cursor-paginated
- Posting an important notice enqueues a fan-out job (one per resident) onto the BullMQ notification queue — never loop and send emails synchronously in the request handler

### Notifications (BullMQ + Upstash Redis + Resend)
- Worker consumes jobs for: (a) complaint status changed → email that resident, (b) important notice posted → email every resident in the society
- Every send attempt is idempotent (job carries a unique key) and logged to `NotificationLog` with status queued/sent/failed
- Provider access behind a small abstraction (`sendEmail(to, subject, body)`) using Resend, so swapping providers later doesn't touch business logic

### Media (Cloudflare R2)
- `POST /media/presign` issues a pre-signed R2 upload URL; client uploads directly to storage, never through the app server
- On upload confirmation, record the `ComplaintPhoto` row
- Serve photos via R2's public URL

### Dashboard
- `GET /dashboard/summary`: counts by status, by category, total overdue, scoped to the admin's society
- Cache response for ~60 seconds via Upstash Redis rather than recomputing on every request

---

## API Design
- Base path `/api/v1`, versioned
- Cursor-based pagination on every list endpoint (`?cursor=&limit=`)
- Idempotency-key support (header-based) on POST/PATCH endpoints
- Endpoints: `/auth/*` (via Better-Auth), `/complaints`, `/complaints/mine`, `/complaints/:id/history`, `/complaints/:id/status`, `/complaints/:id/priority`, `/notices`, `/dashboard/summary`, `/media/presign`

## Security Baseline
- Password hashing handled by Better-Auth (bcrypt/argon2 under the hood)
- Parameterized queries only via Prisma — no raw string-concatenated SQL anywhere
- RBAC enforced at Fastify middleware layer on every route, checking both role and `society_id` match
- Rate limiting on `/auth/*` at minimum (`@fastify/rate-limit`)
- Request body validation via Fastify's built-in JSON schema validation

---

## Deliverables
1. Full source code: `/frontend` (Next.js) and `/backend` (Fastify), TypeScript throughout
2. `README.md`: setup instructions, `.env.example` for both apps, full API documentation, Prisma schema reference, and a short note on which components from the full billion-user design (Kafka, DB sharding, microservices, multi-region) were intentionally deferred and why
3. Seed script: 2–3 demo societies, an admin + a few residents per society, sample complaints across various statuses/ages (include at least one that should trigger overdue), a couple of notices
4. `SYSTEM_DESIGN.md` (max 800 words): complaint history model, overdue detection, photo handling, notification flow — reflecting what was actually implemented, and where it intentionally simplifies the full-scale design
5. Deployment-ready configs: `vercel.json` (frontend) and a `render.yaml` (backend, single free web service with the in-process worker), with all required env vars documented (Neon connection string, Better-Auth secret, R2 credentials, Upstash Redis URL, Resend API key)

## Build Order
1. Prisma schema + Neon migrations — tenant-scoped, append-only-history model first
2. Better-Auth setup + RBAC middleware
3. Complaint CRUD + status history logging + reopen flow
4. BullMQ setup (Upstash-backed): overdue-sweep job + notification queue/worker — **run the worker in-process with the Fastify API** (started on server boot) so the whole backend deploys as a single free Render web service; document in the README that this is an MVP tradeoff and a dedicated worker process should be split out once traffic justifies the paid tier
5. R2 pre-signed media upload flow
6. Notices
7. Dashboard endpoint with Redis caching
8. Frontend: resident views, admin views, dashboard
9. Seed script, README, SYSTEM_DESIGN.md last, reflecting the final implementation

Ask only if something is genuinely ambiguous — otherwise pick reasonable defaults and document the assumption in the README.
