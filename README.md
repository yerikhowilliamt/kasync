# KAsync — Cash Flow Reconciliation & Allocation Tool

A NestJS + PostgreSQL + Prisma application for importing bank transactions, matching them against ledger entries, and managing allocation splits with database-level integrity constraints.

## Tech Stack

- **Runtime:** Node.js >= 20
- **Framework:** NestJS (modular monolith)
- **ORM:** Prisma
- **Database:** PostgreSQL 16
- **Validation:** class-validator / class-transformer
- **Logging:** nestjs-pino
- **API Docs:** @nestjs/swagger (Swagger UI at `/docs`)

## Prerequisites

- Node.js >= 20
- Docker & Docker Compose
- npm

## Setup

### 1. Start PostgreSQL

```bash
docker compose up -d
```

This starts a PostgreSQL 16 container on port 5432 with database `kasync_db`.

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment

```bash
cp .env.example .env
```

Default `.env` values:

```
DATABASE_URL="postgresql://postgres:postgrespassword@localhost:5432/kasync_db?schema=public"
PORT=3000
```

### 4. Run Migrations

```bash
npx prisma migrate dev
```

### 5. Start Development Server

```bash
npm run start:dev
```

The API docs are available at [http://localhost:3000/docs](http://localhost:3000/docs).

## Scripts

| Command | Description |
|---|---|
| `npm run start:dev` | Start in watch mode |
| `npm run build` | Build for production |
| `npm run start:prod` | Start production build |
| `npm run test` | Unit tests |
| `npm run test:e2e` | Integration/E2E tests (requires Postgres) |
| `npm run test:cov` | Test coverage report |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | Typecheck |

## Architecture

Module-per-domain, no cross-module DB access:

```
src/
  modules/
    import/          # CSV parsing, column-mapping config per bank
    matching/        # Matching engine — pure logic
    allocation/      # Allocation CRUD + sum-validation logic
    accounts/        # Account management
    reconciliation/  # Read-side: dashboard queries, status aggregation
  common/
    errors/          # Domain exceptions (e.g. AllocationExceededError)
    filters/         # Exception filters (e.g. PostgresTriggerExceptionFilter)
    prisma/          # Global PrismaModule + PrismaService
```

## Database Triggers

Two PostgreSQL triggers enforce financial invariants at the DB level (ADR-003):

- **`trg_check_allocation_sum`** — BEFORE INSERT/UPDATE on `allocations`: ensures `sum(amount_portion) <= bank_transactions.amount` per transaction. Uses `FOR UPDATE` row lock to prevent race conditions.
- **`trg_sync_transaction_status`** — AFTER INSERT/UPDATE/DELETE on `allocations`: auto-syncs `bank_transactions.status` (`UNRESOLVED` / `PARTIALLY_ALLOCATED` / `MATCHED`).

Both triggers are defined in `prisma/migrations/` and applied via `prisma migrate`.

## License

MIT
