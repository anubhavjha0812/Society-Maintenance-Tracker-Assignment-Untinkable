# System Design

What follows reflects what was actually built (backend under `/backend`),
not an aspirational version — with pointers to where each simplification
lives and what it would take to remove it at scale.

## Complaint history model

`Complaint.current_status` is a denormalized read column; the source of
truth is `ComplaintStatusHistory`, an append-only ledger — every status
change is a new row (`Open`/`InProgress`/`Resolved`/`Reopened`), never an
UPDATE or DELETE against an existing one (`backend/src/modules/complaints/service.ts`,
`updateComplaintStatus`). A transition writes the history row and mirrors
the result onto `current_status` inside one Prisma `$transaction`, so the
two can never drift out of sync mid-request. Status moves are forward-only
(`Open → InProgress → Resolved`); reopening a `Resolved` complaint is a
distinct history status value on the same endpoint rather than a silent
edit, satisfying the spec's "no silent edits after resolution."

At scale this same shape holds — the history table is already the audit
log a billion-user system would want — the only change is moving off a
single Postgres instance's row-level transaction and toward an
event-sourced pipeline (e.g. history writes published to a log, current
status materialized by a downstream consumer) once write volume exceeds
what one Postgres primary can take.

## Overdue detection

A repeatable BullMQ job (`overdueSweep.worker.ts`, every 5 minutes) runs
one set-based `UPDATE ... FROM societies` across every society at once,
each complaint compared against its *own* `overdue_threshold_days` via
`now() - make_interval(days => threshold)`. `is_overdue` is never
computed inline on read — every status transition clears it back to
`false`, and only the sweep sets it back to `true`. The admin complaint
list's compound sort (`overdue → priority → age`) needed real keyset
(cursor) pagination over three columns; Prisma's typed query API can
express the `ORDER BY` but not the `<`/`>` comparisons an enum column
needs for cursor comparison, so that one query is a parameterized
`$queryRaw` encoding the cursor as a Postgres row-value tuple comparison
(`backend/src/modules/complaints/adminSort.ts` — still fully
parameterized, never string-concatenated SQL).

At scale, a fixed 5-minute sweep across *all* complaints in one query
stops being viable once there are millions of Open complaints; that job
would shard by society or by a `created_at` watermark, and likely move
from a polling sweep to a scheduled-expiry mechanism (e.g. a per-complaint
delayed job set at creation time, so the sweep is O(complaints that
became overdue this tick) instead of O(all open complaints) each run).

## Photo handling

`POST /media/presign` issues a short-lived (5 min) pre-signed R2 PUT URL
scoped to `societies/{societyId}/complaints/{complaintId}/{uuid}.{ext}`;
the client uploads directly to R2 — the app server's bandwidth is never in
that path. `POST /media/confirm` then records the `ComplaintPhoto` row,
after re-checking the returned key is actually prefixed with the calling
resident's own society/complaint path (a client can't register a photo
against an arbitrary key). Photos are served via R2's public bucket URL
directly from the client.

This shape doesn't change at scale — direct-to-storage upload with a
confirm step is already the pattern a billion-user system uses. What
would change: a virus/content scan step between confirm and "visible,"
and CDN-fronting the public bucket URL rather than serving straight from
R2.

## Notification flow

Two event types land on one BullMQ `notifications` queue:
`complaint_status_changed` (enqueued on every status transition) and
`notice_posted` (fanned out as one job per resident when an admin posts
an `is_important` notice — never a synchronous send loop in the request
handler). Every job's BullMQ `jobId` doubles as `NotificationLog`'s unique
`idempotency_key`: BullMQ itself refuses a literal duplicate enqueue, and
the worker checks for an existing `sent` row before emailing, covering
job retries/redelivery. `lib/email.ts` wraps Resend behind one
`sendEmail(to, subject, body)` function — nothing else touches the Resend
SDK, so swapping providers is a one-file change.

The worker runs **in-process** with the Fastify API (started on boot),
not as a separate deploy — Render's free tier has no standalone
Background Worker product, only a web service (which sleeps after 15 min
idle). This means queued jobs only get processed while the API is awake.
At real usage, this is the first thing to split out: a dedicated paid
Background Worker (or a small Fly.io/Railway instance) running the same
`queue/workers/*` code against the same Redis, decoupling job throughput
from HTTP traffic entirely — and beyond that, swapping BullMQ/Redis for
Kafka once fan-out volume (e.g. tens of thousands of residents per
important notice) needs true horizontal consumer scaling rather than a
single Redis-backed queue.
