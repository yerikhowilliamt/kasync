# KAsync — Project Investigation & Comprehensive Review Document

**Date:** August 2026  
**Repository:** kasync  
**Status:** Investigation Complete  

---

## 1. Executive Summary

KAsync is a cash flow reconciliation and split-allocation web application tailored for small, multi-branch business owners in Indonesia. It resolves core accounting discrepancies caused by bank settlement timing delays, aggregated manual transactions, and multi-purpose bank transfers covering multiple branches or expense categories.

The application is structured as a **NestJS modular monolith** with **PostgreSQL 16** and **Prisma ORM**. The primary financial invariant — `sum(Allocation.amountPortion) <= BankTransaction.amount` — is guarded at both the application level and via a PostgreSQL trigger (`check_allocation_sum`) acquiring `FOR UPDATE` row-level locks. The project has completed 7 development phases, features 24 unit test files (133 passing unit tests across 25 suites), 8 E2E test suites, 15 Architecture Decision Records (ADRs), and full Swagger API documentation.

---

## 2. Project Purpose

### Simple Explanation
Small business owners often spend hours manually matching bank statement transfers against notebooks or spreadsheets. A single bank transfer might pay for both raw materials and branch fuel, making basic 1:1 categorization impossible. KAsync lets owners import CSV bank statements, automatically match transactions against internal records, split multi-category transfers, and view a dashboard showing real bank vs. recorded balances.

### Technical Explanation
KAsync is a single-tenant financial reconciliation monolith. It ingests CSV statements into `BankTransaction` entities, manages manual entries in `LedgerEntry` entities, proposes matches via a pure TypeScript `MatchingEngine` (exact, fuzzy with date tolerance, and subset-sum aggregation), and records linkages via `Allocation` entities. Money is strictly calculated using `Decimal` (decimal.js) to avoid floating-point errors.

### Target Users
Owner-operators of small multi-branch businesses in Indonesia tracking cash flow manually across multiple bank and cash accounts.

---

## 3. Repository Structure

```
kasync/
├── src/
│   ├── main.ts                          # Bootstrap: CORS, cookie-parser, global prefix /api/v1, ValidationPipe, exception filters
│   ├── app.module.ts                    # Root module: imports 10 domain modules, global ThrottlerGuard & JwtAuthGuard
│   ├── common/                          # Shared infrastructure
│   │   ├── cloudinary/                  # Cloudinary storage provider implementation
│   │   ├── decorators/                  # Custom decorators (@Public(), @ReqUser())
│   │   ├── dto/                         # Shared DTOs (PaginationQueryDto)
│   │   ├── errors/                      # Domain errors (AllocationExceededError)
│   │   ├── filters/                     # Exception filters (PostgresTriggerExceptionFilter)
│   │   ├── guards/                      # Auth guards (JwtAuthGuard)
│   │   ├── middleware/                  # Middleware (CorrelationIdMiddleware)
│   │   ├── prisma/                      # Global PrismaModule & PrismaService
│   │   ├── storage/                     # StorageProvider abstract interface & injection token
│   │   └── validators/                  # File validators (ImageMimeTypeValidator)
│   └── modules/                         # 10 domain feature modules
│       ├── accounts/                    # Account management (BANK, CASH, EWALLET)
│       ├── allocation/                  # Split allocation CRUD, Decimal math, idempotency, soft-revoke
│       ├── auth/                        # Dual JWT authentication (HttpOnly cookies), bcrypt hashing, token refresh
│       ├── branches/                    # Business branch / cost center CRUD
│       ├── categories/                  # Expense / income category CRUD
│       ├── health/                      # Terminus health checks & Prometheus metrics endpoint
│       ├── import/                      # CSV parser factory & statement ingestion (BCA, Mandiri)
│       ├── ledger-entries/              # Manual ledger record CRUD with pagination
│       ├── matching/                    # Pure TS MatchingEngine (exact, fuzzy, aggregation) & service
│       ├── reconciliation/              # Dashboard aggregation service (4-way counts, balance, variance)
│       └── users/                       # User profile, password update, Cloudinary photo upload, account deletion
├── prisma/
│   ├── schema.prisma                    # Primary database schema source of truth (7 models, 4 enums)
│   ├── seed.ts                          # Synthetic demo data seeding script
│   └── migrations/                      # Prisma migration SQL history
├── test/                                # Integration & E2E tests
│   ├── jest-e2e.json                    # E2E test configuration
│   ├── *.e2e-spec.ts                    # 8 E2E test suites (complete lifecycle, triggers, auth, split, import)
│   └── fixtures/                        # CSV test fixtures (bca-valid, bca-duplicate, mandiri-valid, bca-malformed)
├── docs/                                # Project documentation
│   ├── 00 - PRD.md                      # Product Requirements Document
│   ├── 01 - System_Design.md            # System Architecture & Component Design
│   ├── 02 - ADR.md                      # 15 Architectural Decision Records
│   ├── 03 - ERD.md                      # Entity Relationship Diagram & DB design notes
│   ├── 04 - Engineering_Playbook.md     # Code standards, testing strategy, DOD
│   ├── 05 - Project_Handbook.md         # Developer setup guide & glossary
│   ├── TASK_LOG.md                      # Completed task history
│   ├── TROUBLESHOOTING.md               # Error resolution log
│   ├── database/                        # Standalone migration.sql (triggers) & schema.prisma copy
│   ├── phases/                          # Handover context files (phase-01 to phase-07)
│   └── plannings/                       # Sprint/phase planning specs
├── .github/workflows/ci.yml            # CI pipeline (typecheck, lint, unit tests, E2E against Postgres)
├── Dockerfile                           # Production multi-stage Docker build
├── docker-compose.yml                   # Container orchestration (NestJS app + PostgreSQL 16)
├── package.json                         # Package dependencies & npm scripts
└── tsconfig.json                        # TypeScript strict compiler configuration
```

---

## 4. Technology Stack

### Present Technologies
- **Runtime:** Node.js >= 20 LTS
- **Language:** TypeScript 5.7 (strict: true, noImplicitAny: true, ES2023 target)
- **Framework:** NestJS 11
- **Database & ORM:** PostgreSQL 16, Prisma ORM 5.22
- **Financial Math:** decimal.js
- **Authentication & Security:** JWT (`@nestjs/jwt`), bcrypt, `cookie-parser`
- **Validation & DTOs:** `class-validator`, `class-transformer`
- **CSV Parsing:** `csv-parse`
- **Media Storage:** Cloudinary SDK (`cloudinary`)
- **Logging & Observability:** `nestjs-pino`, `@willsoto/nestjs-prometheus`, `prom-client`, `@nestjs/terminus`
- **Rate Limiting:** `@nestjs/throttler`
- **API Documentation:** `@nestjs/swagger`
- **Testing:** Jest 30, Supertest 7, `ts-jest`
- **Linting & Code Quality:** ESLint 9 (flat config `eslint.config.mjs`), Prettier
- **Infrastructure & CI:** Docker (multi-stage), Docker Compose, GitHub Actions

---

## 5. Architecture

**Architectural Style:** Modular Monolith (ADR-001)

### Major Components & Responsibilities
1. **AuthModule:** User registration, dual-token JWT authentication (HttpOnly cookies), refresh token rotation against bcrypt hashes in DB, session revocation.
2. **UsersModule:** User profile management (`GET /users/me`), password updates, profile photo upload via Cloudinary, account deletion.
3. **ImportModule:** Ingests CSV bank statements using Strategy pattern (`BankParser` interface) for BCA and Mandiri formats; deduplicates via `externalRef` or `dedupHash` (SHA-256).
4. **MatchingModule:** Wraps `MatchingEngine` (pure TS) to evaluate exact, fuzzy (date-tolerant), and aggregation (subset sum) candidate matches between bank transactions and ledger entries.
5. **AllocationModule:** Manages `Allocation` records linking `BankTransaction` to `LedgerEntry`. Executes splits atomically inside `prisma.$transaction` with idempotency key support and soft-revoke capability.
6. **ReconciliationModule:** Read-side dashboard aggregation computing 4-way transaction status counts, actual bank balance, recorded ledger balance, and balance variance.
7. **AccountsModule / BranchesModule / CategoriesModule:** Domain entity CRUD services.
8. **HealthModule:** Liveness/readiness probes (`GET /health`) and Prometheus metrics export (`GET /metrics`).

### Architectural Boundaries & Data Flow
- **No direct cross-module DB access:** Modules interact strictly through exported NestJS services.
- **Framework Independence:** `MatchingEngine` is isolated from NestJS/Prisma dependencies.
- **Dependency Inversion:** `UsersService` depends on `StorageProvider` abstract interface, implemented by `CloudinaryService`.
- **Database Integrity Boundary:** PostgreSQL trigger `check_allocation_sum` enforces financial limits at DB level with `FOR UPDATE` row locks to prevent race conditions (ADR-003).

---

## 6. Application Flow

### Primary Reconciliation Lifecycle

```
[ Client CSV Upload ]
         │
         ▼
[ ImportController ] ──► [ ImportService ] ──► [ BankParserFactory ] ──► [ BcaCsvParser / MandiriCsvParser ]
                                                         │
                                                         ▼
                                       [ BankTransaction (UNRESOLVED) ]

[ Matching Request ]
         │
         ▼
[ MatchingController ] ──► [ MatchingService ] ──► [ MatchingEngine (Pure TS) ]
                                                         │
                                                         ▼
                                       [ BankTransaction (PENDING_REVIEW) ]

[ Allocation / Split ]
         │
         ▼
[ AllocationController ] ──► [ AllocationService ] ──► [ prisma.$transaction ]
                                                         │
                                                         ├─► [ Validate Decimal Sum ]
                                                         ├─► [ Idempotency Key Check ]
                                                         └─► [ PostgreSQL Triggers ]
                                                                   │
                                                                   ├─► FOR UPDATE Row Lock
                                                                   └─► Sync Transaction Status
                                                                             │
                                                                             ▼
                                                           [ PARTIALLY_ALLOCATED / MATCHED ]

[ Dashboard Query ]
         │
         ▼
[ ReconciliationController ] ──► [ ReconciliationService ] ──► [ DB Aggregations (_sum, groupBy) ]
                                                                       │
                                                                       ▼
                                                     [ Dashboard Summary Response ]
```

All application flows run synchronously within the HTTP request/response cycle.

---

## 7. Domain Model

### Core Domain Entities
- **User:** Authenticated system user with password hash, refresh token hash, and profile photo URL.
- **Account:** Bank, cash, or e-wallet account (`AccountType: BANK | CASH | EWALLET`).
- **BankTransaction:** Immutable statement record (`amount: Decimal(18,2)`, `type: INFLOW | OUTFLOW`, `status: UNRESOLVED | PENDING_REVIEW | PARTIALLY_ALLOCATED | MATCHED`, `dedupHash`).
- **Category:** Business expense or income classification (e.g., Raw Materials, Fuel).
- **Branch:** Business cost center or physical branch location.
- **LedgerEntry:** Manual internal entry (`amount: Decimal(18,2)`, `type: INFLOW | OUTFLOW`, tied to Category and Branch).
- **Allocation:** Junction entity linking `BankTransaction` to `LedgerEntry` (`amountPortion: Decimal(18,2)`, `status: ACTIVE | REVOKED`, `idempotencyKey`).

### Invariants & Rules
1. **Allocation Sum Invariant:** `sum(Allocation.amountPortion WHERE status = ACTIVE) <= BankTransaction.amount`.
2. **Directional Matching:** `INFLOW` bank transactions match only `INFLOW` ledger entries; `OUTFLOW` matches `OUTFLOW`.
3. **Audit Trail:** Allocations are never hard-deleted; revoking sets `status = REVOKED` and records `revokedAt`.

---

## 8. Data Model

### Database Schema Summary (PostgreSQL 16)

```prisma
model User {
  id               String   @id @default(uuid())
  email            String   @unique
  name             String
  passwordHash     String   @map("password_hash")
  refreshTokenHash String?  @map("refresh_token_hash")
  photoUrl         String?  @map("photo_url")
  tokenValidFrom   DateTime @default(now()) @map("token_valid_from")
  createdAt        DateTime @default(now()) @map("created_at")
  updatedAt        DateTime @updatedAt @map("updated_at")

  accounts      Account[]
  categories    Category[]
  branches      Branch[]
  ledgerEntries LedgerEntry[]
}

model Account {
  id        String      @id @default(uuid())
  userId    String      @map("user_id")
  name      String
  type      AccountType
  createdAt DateTime    @default(now())
  updatedAt DateTime    @updatedAt

  user         User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  transactions BankTransaction[]

  @@index([userId])
}

model BankTransaction {
  id          String            @id @default(uuid())
  accountId   String            @map("account_id")
  txnDate     DateTime          @map("txn_date")
  amount      Decimal           @db.Decimal(18, 2)
  type        TransactionType   @default(OUTFLOW)
  description String
  externalRef String?           @map("external_ref")
  dedupHash   String?           @map("dedup_hash")
  status      TransactionStatus @default(UNRESOLVED)
  importedAt  DateTime          @default(now()) @map("imported_at")

  account     Account      @relation(fields: [accountId], references: [id])
  allocations Allocation[]

  @@unique([accountId, externalRef])
  @@unique([accountId, dedupHash])
  @@index([txnDate])
  @@index([status])
}

model Category {
  id     String @id @default(uuid())
  userId String @map("user_id")
  name   String

  user          User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  ledgerEntries LedgerEntry[]

  @@unique([userId, name])
  @@index([userId])
}

model Branch {
  id     String @id @default(uuid())
  userId String @map("user_id")
  name   String

  user          User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  ledgerEntries LedgerEntry[]

  @@unique([userId, name])
  @@index([userId])
}

model LedgerEntry {
  id         String          @id @default(uuid())
  userId     String          @map("user_id")
  categoryId String          @map("category_id")
  branchId   String          @map("branch_id")
  entryDate  DateTime        @map("entry_date")
  amount     Decimal         @db.Decimal(18, 2)
  type       TransactionType @default(OUTFLOW)
  note       String?

  user        User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  category    Category     @relation(fields: [categoryId], references: [id])
  branch      Branch       @relation(fields: [branchId], references: [id])
  allocations Allocation[]

  @@index([userId])
  @@index([entryDate])
  @@index([categoryId])
  @@index([branchId])
}

model Allocation {
  id                String           @id @default(uuid())
  bankTransactionId String           @map("bank_transaction_id")
  ledgerEntryId     String           @map("ledger_entry_id")
  amountPortion     Decimal          @db.Decimal(18, 2) @map("amount_portion")
  status            AllocationStatus @default(ACTIVE)
  revokedAt         DateTime?        @map("revoked_at")
  idempotencyKey    String?          @unique @map("idempotency_key")

  @@index([bankTransactionId])
  @@index([ledgerEntryId])
}
```

### Database Triggers
1. `check_allocation_sum()`: Executes `BEFORE INSERT OR UPDATE` on `allocations`. Acquires a `SELECT ... FOR UPDATE` lock on `bank_transactions` to prevent TOCTOU race conditions.
2. `sync_transaction_status()`: Executes `AFTER INSERT OR UPDATE OR DELETE` on `allocations`. Recalculates total active allocations and updates `bank_transactions.status`.

---

## 9. API & External Interfaces

**Base Path:** `/api/v1/` (ADR-011)  
**Documentation:** Swagger UI at `/docs`

### Major Endpoints

| Category | Method | Path | Description | Access |
|---|---|---|---|---|
| **Auth** | POST | `/auth/register` | Register user & issue tokens | Public |
| | POST | `/auth/login` | Login user & set cookies | Public |
| | POST | `/auth/refresh` | Rotate access & refresh tokens | Public |
| | POST | `/auth/logout` | Revoke session & clear cookies | Protected |
| **Users** | GET | `/users/me` | Get current user profile | Protected |
| | PATCH | `/users/me/password` | Update current user password | Protected |
| | POST | `/users/me/photo` | Upload profile photo (Cloudinary) | Protected |
| | DELETE | `/users/me` | Delete account | Protected |
| **Import** | POST | `/import/csv` | Import bank CSV statement | Protected |
| **Matching** | POST | `/matching/propose` | Propose transaction matches | Protected |
| **Allocation** | POST | `/allocations` | Create single or split allocation | Protected |
| | POST | `/allocations/:id/revoke` | Soft-revoke an allocation | Protected |
| | GET | `/allocations/transaction/:id` | List allocations by transaction | Protected |
| | GET | `/allocations/ledger-entry/:id` | List allocations by ledger entry | Protected |
| **Ledger** | GET | `/ledger-entries` | List paginated ledger entries | Protected |
| | POST | `/ledger-entries` | Create ledger entry | Protected |
| **Dashboard** | GET | `/reconciliation/dashboard` | Get summary counts & balances | Protected |
| **Health** | GET | `/health` | Liveness & readiness check | Public |
| | GET | `/metrics` | Prometheus metrics export | Public |

---

## 10. Authentication & Authorization

### Mechanism (ADR-009)
- **Dual JWT Tokens via HttpOnly Cookies:**
  - `access_token`: Short lifetime (`1d`), delivered via HttpOnly cookie or `Authorization: Bearer` header.
  - `refresh_token`: Long lifetime (`30d`), delivered via HttpOnly cookie.
- **Session Revocation:** Refresh token is hashed with `bcrypt` and stored in `users.refresh_token_hash`. `POST /auth/logout` sets this field to `null`. Access tokens are validated against `users.tokenValidFrom`: tokens issued more than 2 seconds before `tokenValidFrom` are rejected (2s clock-skew tolerance for Node.js/PostgreSQL drift).
- **Timing Attack Mitigation:** `AuthService.login()` uses constant-time bcrypt comparisons even for non-existent users.
- **Guards:** Global `JwtAuthGuard` applied across `AppModule`. Public endpoints explicitly annotated with `@Public()`.

---

## 11. Configuration & Environment

### Environment Variables (.env.example)
- `DATABASE_URL`: PostgreSQL connection string.
- `PORT`: Server HTTP port (default: `3000`).
- `CORS_ORIGIN`: Allowed origins for CORS (e.g., `http://localhost:3000,http://localhost:5173`).
- `JWT_SECRET`: Signing secret for Access Tokens (required in all environments, ADR-015).
- `JWT_REFRESH_SECRET`: Signing secret for Refresh Tokens (required in all environments, ADR-015).
- `JWT_EXPIRES_IN`: Access Token expiration (default: `"1d"`).
- `JWT_REFRESH_EXPIRES_IN`: Refresh Token expiration (default: `"30d"`).
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`: Cloudinary API configuration.

---

## 12. Error Handling

### Strategy
- **Domain Exceptions:** Services throw domain errors (e.g., `AllocationExceededError`, `NotFoundException`, `BadRequestException`) rather than HTTP responses.
- **Database Trigger Filter:** `PostgresTriggerExceptionFilter` intercepts Prisma error codes `P2010` and `P2034` (thrown by PL/pgSQL trigger failures) and maps them to HTTP 400 Bad Request with formatted JSON.
- **Validation Pipe:** Global NestJS `ValidationPipe` enforces class-validator constraints and strips unwhitelisted properties.
- **Rate Limiting:** `ThrottlerGuard` returns HTTP 429 Too Many Requests upon exceeding 100 requests per minute.
- **Generic 500 Responses:** Unhandled exceptions return a generic message — `'An unexpected error occurred. Please try again later.'` Internal error details are no longer leaked to clients.

---

## 13. Testing Strategy

### Testing Layers
1. **Unit Tests (24 files):**
   - Focus: Pure domain logic (`MatchingEngine`), CSV parsers, service math, controller parameter mapping.
   - Constraints: Zero DB dependencies, fast execution (<1s total).
2. **Integration / Trigger Tests (`test/allocation-trigger.e2e-spec.ts`):**
   - Focus: PostgreSQL trigger execution, concurrent `FOR UPDATE` lock validation, status auto-sync.
3. **E2E Lifecycle Tests (`test/complete-reconciliation-flow.e2e-spec.ts`):**
   - Focus: Complete end-to-end user journey (Register → Import CSV → Propose Matches → Split Allocation → Verify Reconciliation Dashboard).

---

## 14. Observability

- **Structured Logging:** `nestjs-pino` outputs structured JSON logs.
- **Request Correlation IDs:** `CorrelationIdMiddleware` assigns a UUID v4 `X-Correlation-ID` to every HTTP request and attaches it to pino log entries (ADR-013).
- **Metrics:** Prometheus metrics exposed at `GET /metrics` via `@willsoto/nestjs-prometheus` (ADR-014).
- **Health Checks:** Terminus health check exposed at `GET /health` with DB connection status probe.
- **GDPR Privacy:** PII (bank account numbers, owner details) is explicitly masked in logs. Allowed log attributes: `txnId`, `amount` (string), `status`, `processingTimeMs`, `errorCode`.

---

## 15. Build & Development Workflow

### Local Commands
```bash
# 1. Environment Setup
cp .env.example .env

# 2. Database Infrastructure
docker-compose up -d

# 3. Database Migration & Triggers (Embedded in Prisma Migration)
npx prisma migrate dev

# 4. Seed Synthetic Test Data
npm run seed

# 5. Start Development Server
npm run start:dev

# 6. Quality Checks
npx tsc --noEmit        # Typecheck
npm run lint            # ESLint
npm run test            # Unit tests
npm run test:e2e        # Integration & E2E tests
```

---

## 16. Deployment & Infrastructure

- **Containerization:** Production multi-stage `Dockerfile` (builder stage generates Prisma client & compiles TS to `dist/`; runner stage installs production dependencies and runs `npm run start:prod`).
- **Orchestration:** `docker-compose.yml` configures `kasync-app` and `kasync-postgres` (PostgreSQL 16 Alpine with `pg_isready` healthcheck).
- **CI Pipeline (`.github/workflows/ci.yml`):** Runs on push/PR to `main` or `dev`. Spins up a PostgreSQL 16 service container, applies schema migrations and raw SQL trigger migrations, executes `tsc --noEmit`, `npm run lint`, `npm run test`, and `npm run test:e2e`.

---

## 17. Documentation & Knowledge Index

1. **`docs/00 - PRD.md`:** Product Requirements Document & core problem definition.
2. **`docs/01 - System_Design.md`:** System architecture, component map, and data flows.
3. **`docs/02 - ADR.md`:** 15 Architecture Decision Records (ADR-001 through ADR-015).
4. **`docs/03 - ERD.md`:** Database design, index strategies, and relationship rationale.
5. **`docs/04 - Engineering_Playbook.md`:** Engineering standards, DDD rules, testing strategy, and DOD.
6. **`docs/05 - Project_Handbook.md`:** Setup guide, architecture overview, and glossary.
7. **`docs/TASK_LOG.md`:** History of completed tasks and feature implementations.
8. **`docs/TROUBLESHOOTING.md`:** Recorded development errors and verified resolutions.

---

## 18. Important Architectural Decisions

| ADR | Decision | Rationale |
|---|---|---|
| **ADR-001** | Modular Monolith | Single developer, low operational complexity, enforced module boundaries. |
| **ADR-002** | Prisma ORM | Strong type safety for financial amounts, declarative schema. |
| **ADR-003** | Dual Allocation-Sum Constraint | Application check + DB trigger with `FOR UPDATE` lock to prevent TOCTOU race conditions. |
| **ADR-004** | Strategy Pattern for CSV Parsing | `BankParser` interface enables support for new bank formats without altering core code. |
| **ADR-005** | Split Allocation Atomicity | All multi-portion allocation operations execute inside `prisma.$transaction`. |
| **ADR-006** | Single-Tenant & Single-Currency | V1 target is a single Indonesian business using IDR across accounts. |
| **ADR-007** | SHA-256 `dedupHash` Fallback | Deduplicates statement rows for banks omitting external transaction IDs. |
| **ADR-008** | Soft-Revoke Allocations | Preserves complete financial audit trail (`status = REVOKED`). |
| **ADR-009** | Dual-Token Authentication | HttpOnly cookies defend against XSS; hashed DB refresh tokens enable revocation. |
| **ADR-010** | StorageProvider Abstraction | Decouples domain layer from Cloudinary SDK via Dependency Inversion. |
| **ADR-011** | API Versioning `/api/v1/` | Standardized global route prefix for non-breaking API evolution. |
| **ADR-012** | Idempotency Keys | Unique `idempotencyKey` on `Allocation` prevents duplicate writes on retries. |
| **ADR-013** | Request Correlation IDs | UUID v4 attached to `X-Correlation-ID` header for log tracing. |
| **ADR-014** | Prometheus Metrics | Industry-standard observability at `GET /metrics`. |
| **ADR-015** | No JWT Secret Fallbacks | Application fails fast on startup if JWT secrets are missing in any environment. |

---

## 19. Project Lifecycle

A standard operation (e.g., creating a split allocation) proceeds as follows:
1. **Input:** Client submits JSON payload to `POST /api/v1/allocations`.
2. **Validation:** NestJS `ValidationPipe` parses DTO and validates UUIDs and positive numbers.
3. **Authentication:** `JwtAuthGuard` extracts `access_token` cookie, verifies JWT signature, and attaches user payload.
4. **Business Logic:** `AllocationService` groups allocations by `bankTransactionId`, computes Decimal sum, checks running total against `bankTransaction.amount`, and verifies `ledgerEntryId` existence. Concurrent allocation is additionally protected by `SELECT ... FOR UPDATE` row locking inside the `$transaction`, in addition to the app-layer cap check and the DB trigger `check_allocation_sum`.
5. **Persistence:** `prisma.$transaction` executes queries inside a database transaction.
6. **Database Triggers:** PostgreSQL `check_allocation_sum` acquires `FOR UPDATE` row lock on `bank_transactions` and verifies sum. `sync_transaction_status` updates transaction status to `MATCHED` or `PARTIALLY_ALLOCATED`.
7. **Response:** Created `Allocation` entities returned to client with HTTP 201.
8. **Logging:** `CorrelationIdMiddleware` logs request duration and status code with correlation ID.

---

## 20. Critical Components

1. **`MatchingEngine` (`src/modules/matching/matching-engine.ts`):** Pure TypeScript matching algorithm (EXACT, FUZZY, AGGREGATION). Core business logic.
2. **`AllocationService` (`src/modules/allocation/allocation.service.ts`):** Controls allocation creation, Decimal total validations, idempotency handling, and soft-revocations.
3. **PostgreSQL Triggers:** Database-level concurrency guard and status synchronizer.
4. **`PostgresTriggerExceptionFilter` (`src/common/filters/postgres-trigger-exception.filter.ts`):** Converts database PL/pgSQL exceptions to structured HTTP 400 domain responses.
5. **`AuthService` (`src/modules/auth/auth.service.ts`):** Dual-token authentication, token rotation, and bcrypt session store.

---

## 21. Unknowns & Ambiguities

1. **Schema File Drift:** The documentation correctly relies on the active `prisma/schema.prisma` file as the single source of truth.
2. **LedgerEntry Scope:** `LedgerEntry` records are categorized by `Category` and `Branch`, but do not have an explicit `accountId`. Consequently, dashboard `recordedLedgerBalance` represents global recorded totals across all accounts.
3. **Aggregation Subset Bound:** `MatchingEngine.getSubsets()` caps candidate transaction inputs to a maximum of 20 to prevent exponential combinatorial growth during subset-sum processing.

---

## 22. Mental Model

"If I had to explain KAsync to another engineer in 5 minutes:"

KAsync is a NestJS modular monolith for small business cash flow reconciliation. Instead of forcing a naive 1:1 match between bank statement rows and internal records, KAsync introduces an **`Allocation` junction table** that carries an `amountPortion`. This single data model solves three real-world accounting problems: timing delays (fuzzy matching), 3 small deposits matching 1 manual entry (aggregation matching), and 1 large transfer split across 2 branches (split allocation).

Financial totals are calculated using `Decimal` (decimal.js), and allocation caps are enforced twice — once in application code and once inside PostgreSQL using a BEFORE INSERT trigger with `FOR UPDATE` row locking to prevent race conditions. The API uses REST under `/api/v1/`, dual-token JWT authentication delivered via HttpOnly cookies, and structured JSON logging with correlation IDs.

---

## 23. New Engineer Onboarding Summary

### Quick Start Checklist
1. **Understand First:** Read `docs/05 - Project_Handbook.md` Section 6 ("Architecture at a Glance") to understand the `BankTransaction ↔ Allocation ↔ LedgerEntry` model and the allocation sum invariant.
2. **Key Files to Read First:**
   - `prisma/schema.prisma` (Data Model)
   - PostgreSQL Triggers
   - `src/modules/matching/matching-engine.ts` (Pure TS Matching Engine)
   - `src/modules/allocation/allocation.service.ts` (Allocation Logic)
   - `src/common/filters/postgres-trigger-exception.filter.ts` (Exception Filter)
3. **Environment Setup & Run:**
   - Run `cp .env.example .env`
   - Run `docker-compose up -d`
   - Run `npx prisma migrate dev` (triggers are embedded in migration)
   - Run `npm run seed`
   - Start app with `npm run start:dev`
   - Run unit tests with `npm run test`
   - Run E2E tests with `npm run test:e2e`
4. **Primary Documentation Sequence:** PRD (`00`) → System Design (`01`) → ADR (`02`) → ERD (`03`) → Engineering Playbook (`04`) → Project Handbook (`05`).
