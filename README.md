<div align="center">
  <h1>🏢 Society Maintenance Tracker</h1>
  <p>A modern, multi-tenant residential society management platform.</p>
  
  [![Next.js](https://img.shields.io/badge/Next.js-14.2-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
  [![Fastify](https://img.shields.io/badge/Fastify-5.0-black?style=for-the-badge&logo=fastify)](https://fastify.dev/)
  [![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon-blue?style=for-the-badge&logo=postgresql)](https://neon.tech/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
</div>

<br/>

**Society Maintenance Tracker** is a robust, multi-tenant platform designed to streamline complaints, notices, and dashboard management for residential societies. Built from the ground up with production-correct patterns—tenant scoping, append-only history, cursor pagination, async jobs, and direct-to-storage uploads—it's engineered to scale effortlessly. 

---

## ✨ Features

- **Multi-Tenant Architecture**: Securely manage multiple societies within a single deployment.
- **Robust Authentication**: Powered by Better-Auth with secure email/password and self-service society selection at registration.
- **Role-Based Access**: Distinct resident and admin views tailored to specific needs.
- **Real-Time Issue Tracking**: File, track, and resolve complaints with an append-only status history.
- **High-Performance API**: Built on Fastify 5, featuring cursor pagination and idempotent operations.
- **Media Uploads**: Direct-to-storage photo uploads using Cloudflare R2 presigned URLs.
- **Async Processing**: Reliable background job execution using Upstash Redis and BullMQ.

---

## 🛠️ Technology Stack

| Component | Technology |
|---|---|
| **Frontend** | Next.js 14 (App Router), TypeScript, Tailwind CSS |
| **Backend** | Node.js, TypeScript, Fastify 5 |
| **Database** | PostgreSQL (Neon), Prisma ORM |
| **Authentication** | Better-Auth |
| **Object Storage** | Cloudflare R2 (pre-signed direct upload) |
| **Queue / Cache** | Upstash Redis + BullMQ |
| **Email** | Resend |
| **Hosting** | Vercel (Frontend), Render (Backend) |

## 📂 Repository Structure

```text
/backend            # Fastify API, Prisma schema, BullMQ workers (in-process)
/frontend           # Next.js application (resident + admin views)
SYSTEM_DESIGN.md    # Architectural decisions and scalability considerations
documentation.txt   # Step-by-step build log and decisions
commands.txt        # Comprehensive list of build commands executed
```

---

## 🚀 Getting Started

Follow these steps to set up the platform locally.

### 1. Provision Free-Tier Services

To run the full suite of features, provision the following services:
- **[Neon](https://neon.tech/)**: Create a Postgres project and copy the pooled connection string.
- **[Upstash](https://upstash.com/)**: Create a **Redis** database (ensure it's Redis, not QStash). Match the region to your Neon DB/Render backend (e.g., `us-east-2`/Ohio). Copy the **TCP** connection string (`rediss://...`).
- **[Cloudflare R2](https://dash.cloudflare.com/)**: Create a bucket and generate an API token (Account ID, Access Key ID, Secret Access Key). Enable public access or a custom domain.
- **[Resend](https://resend.com/)**: Generate an API key and verify a sending domain (or use sandbox mode for testing).

### 2. Backend Setup

```bash
cd backend
cp .env.example .env   # Populate with values from Step 1
npm install
npm run prisma:migrate # Applies database schema
npm run seed           # Creates 3 demo societies, admins, residents, and sample data
npm run dev            # Starts the API at http://localhost:4000
```

### 3. Frontend Setup

```bash
cd frontend
cp .env.example .env.local
# Set NEXT_PUBLIC_API_URL=http://localhost:4000
# Set NEXT_PUBLIC_R2_PUBLIC_BASE_URL=<your R2 public base URL>
npm install
npm run dev            # Starts the web app at http://localhost:3000
```

> **Demo Access**: After seeding, log in at `/login` using any seeded email (password: `Password123!`) or register a new account at `/register`, picking your society from the dropdown.

---

## ☁️ Deployment Guide

The repository is configured for immediate deployment using Render and Vercel. 

### 1. Backend (Render)
1. In your [Render Dashboard](https://dashboard.render.com), select **New +** → **Blueprint** and connect this repository. Render will auto-detect `render.yaml`.
2. Provide the required environment variables:
   - `DATABASE_URL`: Your Neon connection string.
   - `BETTER_AUTH_SECRET`: Generate a random string (e.g., `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`).
   - `BETTER_AUTH_URL`: Placeholder (e.g., `https://society-tracker-backend.onrender.com`). Update this after the first deploy.
   - `FRONTEND_URL`: Placeholder for the upcoming Vercel URL.
   - `UPSTASH_REDIS_URL`, `R2_*`, `RESEND_*`: Your production service credentials.
3. Deploy. The initial boot automatically runs database migrations.

### 2. Frontend (Vercel)
1. Import the repository in [Vercel](https://vercel.com/new).
2. Set the **Root Directory** to `frontend`.
3. Configure Environment Variables:
   - `NEXT_PUBLIC_API_URL`: Your deployed Render backend URL.
   - `NEXT_PUBLIC_R2_PUBLIC_BASE_URL`: Your public R2 bucket URL.
4. Deploy.

### 3. Finalizing the Connection
Update the `BETTER_AUTH_URL` and `FRONTEND_URL` in your Render backend settings with the exact production URLs, and trigger a redeploy. This ensures secure cross-domain session cookies (`SameSite=None; Secure`) function correctly.

*(Optional)* Run `npm run seed` against your production database to populate demo data.

---

## 🔌 API Reference

The platform features a stable `v1` API with cursor-based pagination and idempotency controls.

**Base Path**: `/api/v1`

| Endpoint | Description |
|---|---|
| `POST/GET /auth/*` | Authentication operations (Powered by Better-Auth) |
| `POST /complaints` | Resident: Create a new complaint |
| `GET /complaints/mine` | Resident: View own complaints (paginated) |
| `GET /complaints` | Admin: Filtered & sorted complaints list |
| `GET /complaints/:id` | View specific complaint details |
| `GET /complaints/:id/history` | View append-only status history |
| `PATCH /complaints/:id/status` | Admin: Update status (`InProgress`, `Resolved`, `Reopened`) |
| `PATCH /complaints/:id/priority` | Admin: Update priority (`Low`, `Medium`, `High`) |
| `POST /media/presign` | Storage: Request direct-upload URL |
| `POST /media/confirm` | Storage: Confirm successful upload |
| `POST /notices`, `GET /notices` | Admin: Manage society notices |
| `GET /dashboard/summary` | Admin: 60s Redis-cached overview metrics |

> **Detailed API Documentation**: See [API.md](./API.md) for complete request/response payloads, status codes, and error shapes.

---

## 🏗️ Architecture & Engineering Decisions

### Scale & Verification
The core stack (Postgres, Prisma, Better-Auth, Fastify) is rigorously live-tested under real-world conditions, including edge cases like Redis outages and strict RBAC enforcement. 

### Strategic Deferments for Scale
While engineered for reliability, certain hyper-scale features are intentionally deferred to optimize the current operational footprint:
- **Message Broker (Kafka)**: A single Redis-backed BullMQ instance gracefully handles current asynchronous job volume.
- **Database Sharding**: Postgres connection pooling via Neon isolates society data efficiently without the overhead of immediate sharding.
- **Microservices Split**: The backend employs a modular monolith architecture (`modules/complaints`, `modules/notices`). It is structured to be split into discrete services in the future without a total rewrite.
- **Standalone Background Workers**: Workers run in-process with the API to maximize free-tier hosting limits. Transitioning to standalone workers is a simple configuration change.

### Developer Notes & Deviations
- **Authentication Data Model**: Better-Auth manages credentials internally via the `Account` entity rather than a literal `password_hash` column on the `User` table, ensuring robust, provider-agnostic security.
- **Dependencies**: Fastify v5 is utilized to mitigate high-severity vulnerabilities present in v4. Next.js is maintained at 14.2.x, balancing security patches with API stability.

For an exhaustive log of technical decisions and assumptions, refer to [SYSTEM_DESIGN.md](./SYSTEM_DESIGN.md) and [documentation.txt](./documentation.txt).
