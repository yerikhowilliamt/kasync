# Project Handbook
## Cash Flow Reconciliation & Allocation Tool

**Status:** Active  
**Version:** 1.0  
**Target Audience:** Developers & Contributors  
**Last Updated:** August 2026

---

## 1. Project Overview

The **Cash Flow Reconciliation & Allocation Tool** is a web-based application designed to help small multi-branch business owners reconcile manual cash records against bank statements.

It solves three critical operational challenges:
- **Timing Gaps** (bank settlement delays).
- **Aggregated / Split Transactions** (N bank txns = 1 manual record, or vice-versa).
- **Multi-purpose / Multi-branch Transfers** (1 bank txn split into multiple expense categories/branches).

---

## 2. Technical Stack Quick Reference

| Layer | Technology |
|---|---|
| **Runtime & Language** | Node.js v20 LTS, TypeScript 5.x |
| **Framework** | NestJS |
| **Database** | PostgreSQL 16 |
| **ORM** | Prisma |
| **Testing** | Jest, Supertest |
| **Dev Ops & Infra** | Docker, Docker Compose |

---

## 3. Local Development Setup

### Prerequisites
- Node.js >= 20.x
- npm >= 10.x
- Docker Desktop or OrbStack (for local PostgreSQL)

### Step 1: Environment Configuration
Copy the template configuration file:
```bash
cp .env.example .env
```

Ensure `.env` contains:
```env
PORT=3000
NODE_ENV=development
CORS_ORIGIN="http://localhost:3000,http://localhost:5173"
DATABASE_URL="postgresql://postgres:postgrespassword@localhost:5432/kasync_db?schema=public"
JWT_SECRET="super-secret-access-key"
JWT_REFRESH_SECRET="super-secret-refresh-key"
JWT_EXPIRES_IN="1d"
JWT_REFRESH_EXPIRES_IN="30d"
CLOUDINARY_CLOUD_NAME="your-cloud-name"
CLOUDINARY_API_KEY="your-api-key"
CLOUDINARY_API_SECRET="your-api-secret"
```

### Step 2: Spin Up Infrastructure
Start the PostgreSQL container:
```bash
docker-compose up -d
```

### Step 3: Run Database Migrations & Triggers
Run Prisma schema migration — database triggers (`check_allocation_sum` with `FOR UPDATE` lock and `sync_transaction_status`) are embedded in the native Prisma migration and applied automatically:
```bash
npx prisma migrate dev
```

### Step 4: Seed Synthetic Test Data (GDPR Safe)
Populate local database with synthetic accounts, branches, and categories:
```bash
npm run seed
```

### Step 5: Start Application
```bash
# Development mode with hot-reload
npm run start:dev
```

---

## 4. Key Scripts Reference

| Command | Purpose |
|---|---|
| `npm run start:dev` | Start NestJS app in watch mode |
| `npm run test` | Run unit tests (Matching engine, parsers) |
| `npm run test:e2e` | Run integration/E2E test suite (including complete lifecycle flow) |
| `npx prisma studio` | Open Prisma visual database manager |
| `npm run lint` | Run ESLint check |
| `npx tsc --noEmit` | Execute TypeScript strict type check |

---

## 5. Synthetic Fixtures & Data Safety

- The problem this project solves — and the early test scenarios used to validate it — come from a real small business owner's actual reconciliation struggles. That source data (and anything derived closely enough from it to be identifiable) must never be committed, demoed publicly, or included in fixtures — synthetic data only, always.
- All CSV test fixtures stored under `test/fixtures/` must be anonymized using synthetic account numbers, random business names, and rounded test amounts.

## 6. Architecture at a Glance
 
Kasync is a **modular monolith** (NestJS) — one deployable service, internally split into domain modules (`import`, `matching`, `allocation`, `account`, `reconciliation`), each with a hard boundary: no module reaches directly into another module's database models.
 
**The one thing to understand before touching anything:**
A `BankTransaction` and a `LedgerEntry` are never linked directly. They're connected through an **`Allocation`** junction table, which carries a portion of the amount. This one pattern is what makes three different real-world problems solvable with a single, consistent model instead of three separate mechanisms:
 
- **Timing gaps** → handled at the matching stage (a date-tolerance window when proposing a match).
- **Aggregated transactions** (3 small deposits = 1 manual record) → multiple `BankTransaction` rows point to one `LedgerEntry`, via separate `Allocation` rows.
- **Multi-category / multi-branch transfers** (1 transfer = raw materials + fuel, split across branches) → one `BankTransaction` is split across multiple `Allocation` rows, each pointing to a different `LedgerEntry` (different category/branch).
**The invariant that must never break:** the sum of `Allocation.amountPortion` for any given `BankTransaction` can never exceed that transaction's `amount`. This is enforced twice — once in application code, once by a PostgreSQL trigger (`check_allocation_sum` in `docs/database/migration.sql`) — so a bug in the app layer alone can't corrupt financial data. If you're changing anything inside `modules/allocation/` or `modules/matching/`, read the relevant ADR entry first (see Section 8).

**Idempotency:** Allocation requests support an optional `idempotencyKey` — if two identical requests arrive with the same key, the second returns the existing allocation instead of creating a duplicate. This prevents double-allocations from network retries. Keys are scoped per user via `bankTransaction` ownership — two users may reuse the same key without collision, and the lookup is always filtered to the requesting user's records.
 
---
 
## 7. Glossary
 
| Term | Meaning |
|---|---|
| **Bank transaction** | An atomic, imported row from a bank statement CSV. Immutable in practice — never edited after import, only allocated. |
| **Ledger entry** | A categorized manual record: one category + one branch + date + note. |
| **Allocation** | A junction record linking one bank transaction to one ledger entry, carrying the portion of the amount assigned to it. |
| **Matched** | A bank transaction whose allocations sum exactly to its amount. |
| **Partially allocated** | A bank transaction with some, but not all, of its amount allocated. |
| **Unresolved** | A bank transaction with zero allocations — no proposed or confirmed match yet. |
| **Aggregation match** | A proposed match where multiple bank transactions together sum to one ledger entry's amount. |
| **Idempotency Key** | An optional client-supplied unique identifier for a request. If two requests carry the same key, the second returns the existing result instead of creating a duplicate. |
| **Correlation ID** | A UUID v4 assigned to every HTTP request for end-to-end tracing in structured logs. Clients may supply their own via `X-Correlation-ID` header. |
| **Prometheus Metrics** | Standard-formatted metrics exposed at `GET /api/v1/metrics` for dashboarding and alerting (request rate, error rate, latency). |
 
---
 
## 8. Documentation Index

| Looking for... | Go to |
|---|---|
| Product requirements / scope | `docs/00 - PRD.md` |
| System architecture & component design | `docs/01 - System_Design.md` |
| Why a technical decision was made | `docs/02 - ADR.md` |
| Database schema & design rationale | `docs/03 - ERD.md`, `docs/database/schema.prisma` |
| Coding conventions, testing, review standards | `docs/04 - Engineering_Playbook.md` |
| Project Handbook & Setup | `docs/05 - Project_Handbook.md` |
 
This handbook is the map — start here, then go deep in the doc that covers what you actually need.
 
---
 
## 9. Known Constraints & Scope Boundaries
 
Things worth knowing *before* writing code, so you don't accidentally rebuild something that was deliberately left out of v1:
 
- **No auto-confirm.** Every proposed match and every allocation requires explicit user confirmation. There is no fully automatic reconciliation mode in v1 — this is intentional, not a missing feature (see PRD, Section 5.5).
- **CSV import is per-bank, explicit mapping — not a generic parser.** Adding support for a new bank means adding a new mapping config entry, not building a smarter auto-detection system (see ADR-004).
- **No PDF statement parsing in v1.** CSV only. PDF parsing was deliberately deferred — bank PDF export formats vary too much to support reliably in early scope.
- **No cash flow forecasting in v1.** This is a reconciliation tool, not a projection tool — forecasting is a Phase-2-or-later idea, not current scope.
- **All API endpoints are versioned under `/api/v1/`.** Future breaking changes will introduce `/api/v2/` without removing v1 immediately. Clients must use the versioned prefix.
- **JWT secrets are required in all environments.** The application refuses to start if `JWT_SECRET` or `JWT_REFRESH_SECRET` are missing from the environment — no hardcoded fallbacks (see ADR-015).
---
 
## 10. Contributing & Workflow
 
Follow the branching, commit, and self-review conventions in `docs/04 - Engineering_Playbook.md` (Sections 5-7) for any change. In short: short-lived feature branches, Conventional Commits, and a deliberate self-review pass against the Playbook's checklist before merging to `main` — there's no second engineer to open a PR against, so that checklist *is* the review.
 
---
 
## 11. Troubleshooting

| Problem | Likely cause / fix |
|---|---|
| `docker-compose up -d` fails, port 5432 already in use | Another local Postgres instance is running. Stop it, or remap the port in `docker-compose.yml` and update `DATABASE_URL` accordingly. |
| `prisma migrate dev` succeeds but allocation over-limits aren't rejected | Triggers are embedded in the Prisma migration `20260809180000_multi_tenancy_and_triggers`. If using an older migration history, run `npx prisma migrate reset` then `npx prisma migrate dev` to reapply all migrations including triggers. |
| Seed script fails with a foreign key error | Run `npx prisma migrate reset` to get a clean schema before reseeding — usually caused by seeding against a partially-migrated database. |