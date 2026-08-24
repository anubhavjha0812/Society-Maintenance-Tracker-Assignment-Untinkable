# API Reference

Base URL: `<backend>/api/v1` (e.g. `http://localhost:4000/api/v1` in dev).

This is the detailed reference; `README.md`'s API section is a quick
summary table that links here.

## Conventions

**Auth.** Every endpoint except `/auth/*` requires a valid Better-Auth
session cookie (sent automatically by the browser once signed in; set
`credentials: "include"` on `fetch` calls). `society_id` is *never*
accepted as a client parameter anywhere — it's always resolved from the
authenticated session, which is what makes cross-tenant access
impossible by construction. Endpoints marked **Admin** require role
`society_admin` or `super_admin`; a resident calling one gets `403`.

**Pagination.** Every list endpoint is cursor-based:
`?cursor=<opaque-string>&limit=<1-100, default 20>`. Response shape:

```json
{ "items": [ /* ... */ ], "nextCursor": "eyJjcmVh..." /* or null if no more pages */ }
```

Pass the previous response's `nextCursor` back as `?cursor=` to get the
next page. There is no offset/page-number parameter anywhere.

**Idempotency.** `POST`/`PATCH` endpoints accept an `Idempotency-Key`
header (any client-generated unique string, e.g. a UUID per user
action). Replaying the same key within 24h returns the original response
byte-for-byte instead of re-running the request — safe for a client to
retry a timed-out request without risking a duplicate (e.g. a resident
double-tapping "Submit" on a flaky connection). Two concurrent requests
with the same key: the first runs normally, the second gets `409` if the
first is still in flight, or the first's cached response if it already
finished.

**Errors.** Non-2xx responses are JSON: `{ "error": "<code>", "message": "<human-readable>" }`.

| HTTP | `error` | Meaning |
|---|---|---|
| 400 | `bad_request` / `validation_error` | Malformed input |
| 401 | `unauthorized` | No/invalid session |
| 403 | `forbidden` | Signed in, but wrong role or society |
| 404 | `not_found` | Resource doesn't exist, or exists in a different society/isn't yours |
| 409 | `conflict` / `request_in_progress` | Illegal state transition, or a duplicate in-flight idempotent request |
| 422 | (Better-Auth's own codes) | Auth-specific validation failures |
| 500 | `internal_error` | Unexpected server error |

---

## Auth — `/auth/*`

Bridged directly to [Better-Auth](https://better-auth.com)'s own request
handler (`backend/src/modules/auth/routes.ts`), so this app doesn't
reimplement auth endpoints — the ones actually used by the frontend:

### `POST /auth/sign-up/email`

Registers a **resident**. `society_id` and `role` are never
client-settable — the invite code resolves them server-side (see
`backend/src/modules/auth/auth.ts`'s sign-up hook). The one admin per
seeded society is created by `prisma/seed.ts`, not through this endpoint.

```json
// Request
{
  "name": "Rahul Mehta",
  "email": "rahul@willowbrook.test",
  "password": "Password123!",   // min 8 chars
  "inviteCode": "WILLOW01",
  "flatNumber": "A-101",         // optional
  "phone": "+91..."              // optional
}
```

```json
// 200 response
{
  "token": "...",
  "user": {
    "id": "...", "name": "Rahul Mehta", "email": "rahul@willowbrook.test",
    "role": "resident", "societyId": "...", "flatNumber": "A-101",
    "emailVerified": false, "createdAt": "...", "updatedAt": "..."
  }
}
```
Sets the session cookie. `400` with `{"message":"Invalid invite code"}` or
`{"message":"inviteCode is required to register"}` on a bad/missing code.

### `POST /auth/sign-in/email`

```json
{ "email": "rahul@willowbrook.test", "password": "Password123!" }
```
`200` with the same `{ token, user }` shape and sets the session cookie,
or `401 {"code":"INVALID_EMAIL_OR_PASSWORD"}`.

### `GET /auth/get-session`

Returns the current session (`{ session, user }`) or `null` if signed out.

### `POST /auth/sign-out`

Clears the session cookie.

### `POST /auth/update-user`

Updates the caller's own profile. **`role` and `societyId` are rejected
outright** (`403 {"message":"role and societyId cannot be set through this endpoint"}`)
even though they're technically valid `additionalFields` on the User
model — this is a deliberate guard (see `documentation.txt` Step 13)
closing what would otherwise be a privilege-escalation hole. Legitimate
fields (`name`, `flatNumber`, `phone`, `image`) work normally:

```json
{ "flatNumber": "A-102" }
```

Requires an `Origin` header matching `FRONTEND_URL` (Better-Auth's own
CSRF protection) — the browser sends this automatically; a bare `curl`
needs `-H "Origin: <frontend URL>"`.

---

## Complaints

### `POST /complaints` — Resident

Creates a complaint. Also writes the first `ComplaintStatusHistory` row
(status `Open`) in the same transaction.

```json
// Request
{
  "category": "Plumbing",        // 1-80 chars
  "description": "Leaking pipe under the sink", // 1-4000 chars
  "priority": "High"             // optional, "Low"|"Medium"|"High", default "Medium"
}
```
`201` with the created complaint (see shape under `GET /complaints/:id`).

### `GET /complaints/mine` — Resident

The caller's own complaints, newest first.

Query: `?cursor=&limit=`

```json
{ "items": [ /* Complaint[] */ ], "nextCursor": null }
```

### `GET /complaints` — Admin

All complaints in the admin's society. Sorted **overdue → priority →
age** (oldest-in-that-bucket first) — a real 3-key keyset-paginated
query, not offset-based (see `backend/src/modules/complaints/adminSort.ts`).

Query params (all optional except pagination):
`?cursor=&limit=&category=<string>&status=Open|InProgress|Resolved&priority=Low|Medium|High&from=<ISO date-time>&to=<ISO date-time>`

```json
{ "items": [ /* Complaint[] */ ], "nextCursor": "..." }
```

### `GET /complaints/:id` — Resident (own only) / Admin (any in society)

Not in the original spec's literal endpoint list — added because a
detail view needs a way to fetch one complaint's core fields; see
`documentation.txt` Step 3.

```json
// Complaint shape (used across all the endpoints above and this one)
{
  "id": "cmt...", "societyId": "cmt...", "residentId": "cmt...",
  "category": "Plumbing", "description": "Leaking pipe under the sink",
  "priority": "High", "currentStatus": "Open", "isOverdue": false,
  "createdAt": "2026-08-24T...", "updatedAt": "2026-08-24T...",
  "photos": [ { "id": "...", "objectStorageKey": "societies/.../complaints/.../uuid.jpg", "contentType": "image/jpeg" } ]
}
```
`404` if the complaint doesn't exist, belongs to another society, or
(for a resident) belongs to another resident.

### `GET /complaints/:id/history` — Resident (own only) / Admin (any in society)

Full append-only status history, oldest first. Never mutated —
every row here is a permanent record of one transition.

```json
[
  {
    "id": "...", "complaintId": "...", "status": "Open",
    "note": null, "actorId": "...", "timestamp": "2026-08-24T...",
    "actor": { "id": "...", "name": "Rahul Mehta", "role": "resident" }
  },
  {
    "id": "...", "complaintId": "...", "status": "InProgress",
    "note": "Plumber scheduled for tomorrow", "actorId": "...",
    "timestamp": "2026-08-24T...",
    "actor": { "id": "...", "name": "Priya Nair", "role": "society_admin" }
  }
]
```

### `PATCH /complaints/:id/priority` — Admin

```json
{ "priority": "High" }
```
`200` with the updated complaint (includes `photos`).

### `PATCH /complaints/:id/status` — Admin

Status only ever moves forward (`Open → InProgress → Resolved`); once
`Resolved`, the only way back is the explicit `Reopened` action — never
a silent edit. Each call appends one history row.

```json
{ "status": "InProgress", "note": "Plumber scheduled for tomorrow" }  // note is optional
```

Valid `status` values: `"InProgress"`, `"Resolved"`, `"Reopened"`
(`"Reopened"` is only accepted when `currentStatus` is currently
`Resolved`, and resets it back to `Open`). `409 {"error":"conflict"}` on
an illegal transition (e.g. `Reopened` on a non-Resolved complaint, or
skipping/reversing status otherwise).

---

## Media (Cloudflare R2)

Two-step direct-upload flow — the app server never sees the file bytes.

### `POST /media/presign` — Resident, must own the target complaint

```json
{ "complaintId": "cmt...", "contentType": "image/jpeg", "sizeBytes": 204800 }
```
Allowed `contentType`: `image/jpeg`, `image/png`, `image/webp`,
`image/heic`. Max `sizeBytes`: 10 MB. `400` if either check fails,
`404` if the complaint isn't the caller's own.

```json
// 200 response
{
  "uploadUrl": "https://<account>.r2.cloudflarestorage.com/...(signed)...",
  "objectStorageKey": "societies/<societyId>/complaints/<complaintId>/<uuid>.jpg",
  "publicUrl": "https://<R2_PUBLIC_BASE_URL>/societies/.../uuid.jpg",
  "expiresInSeconds": 300
}
```

Client then `PUT`s the raw file bytes directly to `uploadUrl` with
header `Content-Type: <same contentType>`.

### `POST /media/confirm` — Resident, must own the target complaint

Called after the direct `PUT` succeeds, to record the photo row.

```json
{
  "complaintId": "cmt...",
  "objectStorageKey": "societies/<societyId>/complaints/<complaintId>/<uuid>.jpg",
  "contentType": "image/jpeg",
  "sizeBytes": 204800
}
```
Re-validates content-type/size independently of `/presign` (a client
could otherwise skip presign and call confirm directly), and checks
`objectStorageKey` is actually prefixed with the caller's own
society/complaint path. `201` with the created `ComplaintPhoto` row.

---

## Notices

### `POST /notices` — Admin

```json
{ "title": "Water supply maintenance", "body": "Shut off 10am-2pm Saturday.", "isImportant": true }
```
`isImportant` defaults to `false`. Posting with `isImportant: true` fans
out one notification job per resident onto the BullMQ queue (never a
synchronous send loop) — see `SYSTEM_DESIGN.md`. `201` with the created
notice.

### `GET /notices` — Any authenticated user (resident or admin)

Cursor-paginated, important notices pinned to the top, then newest first.

Query: `?cursor=&limit=`

```json
{
  "items": [
    {
      "id": "...", "societyId": "...", "title": "Water supply maintenance",
      "body": "Shut off 10am-2pm Saturday.", "isImportant": true,
      "postedBy": "...", "createdAt": "2026-08-24T..."
    }
  ],
  "nextCursor": null
}
```

---

## Dashboard

### `GET /dashboard/summary` — Admin

Counts scoped to the admin's own society, cached in Redis for 60s
(spec's explicit requirement — a cache miss recomputes and repopulates).

```json
{
  "totalOpen": 4, "totalInProgress": 2, "totalResolved": 7, "totalOverdue": 1,
  "byCategory": [
    { "category": "Plumbing", "count": 5 },
    { "category": "Electrical", "count": 3 }
  ]
}
```
