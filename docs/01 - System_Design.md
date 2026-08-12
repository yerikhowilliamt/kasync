# Technical / System Design Document
## Cash Flow Reconciliation & Allocation Tool

**Status:** Draft v1.0
**Related:** [PRD](./00%20-%20PRD.md)
**Last updated:** August 2026

---

## 1. Purpose

This document translates the PRD's product requirements into concrete technical decisions: system shape, components, data flow, and technology choices. It is the input for the Architecture Decision Records (ADR) and the basis for sprint/task planning.

---

## 2. System Shape

**Decision: Modular monolith**, not microservices.

**Rationale:**
- Single developer, no operational team to manage multiple deployed services.
- The core complexity of this product is in business logic (matching, allocation validation), not in independent scaling of components — microservices would add deployment/operational overhead without solving a real scaling problem at this stage.
- A modular monolith still enforces clean boundaries between domains (Import, Matching, Allocation, Account) via separate NestJS modules, so a future split into services remains possible if genuinely needed later.

**Alternative considered:** Microservices per domain (import service, matching service, allocation service). Rejected for v1 — no current requirement justifies the added infrastructure complexity (service discovery, inter-service communication, distributed transactions across what should be one consistent data boundary).

---

## 3. High-Level Components

| Module | Responsibility |
|---|---|
| **Auth** | Manages user registration, login, token refresh, and logout. Generates JWT Access Tokens (1d) and Refresh Tokens (30d). Validates Refresh Tokens against hashed entries in PostgreSQL. Logout sets `tokenValidFrom`; `JwtAuthGuard` rejects tokens with `iat * 1000 + 2000 < tokenValidFrom.getTime()` (2-second clock-skew tolerance). Brute-force protection via `@nestjs/throttler`: 10 req/min on `POST /auth/register` and `POST /auth/login`, 100 req/min globally. |
| **Users** | Handles fetching current profile (`GET /users/me`), password changes (`PATCH /users/me/password`), profile photo uploads streaming to Cloudinary (`POST /users/me/photo`), and account deletion (`DELETE /users/me`). |
| **Cloudinary / Media** | Centralized media & file upload service (`CloudinaryService`) handling image and raw media stream uploads to Cloudinary for all application modules. Cloudinary config is lazy-initialized — env vars validated on first `uploadFile()` call, not at construction, so the app boots fine in environments without Cloudinary configured (test, CI). |
| **Import** | Parses uploaded CSV bank statements into normalized `bank_transaction` records via a unified `BankParser` interface (Strategy pattern per bank format). |
| **Matching engine** | Runs exact, fuzzy (date-tolerant, $\pm 3$ days max), and aggregation matching (bounded to $N \le 4$ subset size, max 20 candidates, identical INFLOW/OUTFLOW type) between `bank_transaction` and `ledger_entry`. Uses UTC calendar-date comparison for date diff (not wall-clock ms), ensuring midnight-straddling timestamps produce correct FUZZY classification. Ledger entries are scoped to a date window around matched transactions to avoid unbounded memory usage. Pure business logic, no HTTP/DB dependency in its core so it can be unit tested in isolation. |
| **Allocation** | Manages the `allocation` junction records — creating splits inside a single database transaction (`prisma.$transaction`), validating that allocated portions sum to the transaction amount, tracking unresolved balances. Concurrency-safe: the parent `bank_transactions` row is locked with `SELECT ... FOR UPDATE` inside the transaction before the running total is read (three-layer defense: app-layer cap check → `FOR UPDATE` row lock → DB trigger `check_allocation_sum`). |
| **Account** | Manages multiple bank/cash accounts per business, source-account tagging for every transaction. |
| **Reconciliation API / Dashboard** | Read-side: aggregates status (matched / pending review / needs allocation / unresolved), computes recorded vs. actual balance, serves the dashboard views. Balance calculation always uses total bank position (ignores status filter); status filter only affects count breakdown. Proposed matches from matching engine are computed on-the-fly (stateless) or flagged as `PENDING_REVIEW` when user initiates allocation review. |
| **Health / Metrics** | System health checks (`GET /health`), Prometheus metrics endpoint (`GET /metrics`), request correlation ID middleware for end-to-end tracing. |

**Design principle:** the Matching engine and Allocation validation logic are kept as plain, framework-independent TypeScript classes/functions wrapped by NestJS services — not embedded directly in controllers. This keeps the highest-risk logic (the part most likely to have subtle bugs) testable without spinning up HTTP or a database in tests.

---

## 4. Data Flow (happy path)

1. Client uploads a CSV bank statement → **Import** module parses and stores `bank_transaction` rows.
2. Client submits/imports manual records → stored as candidate `ledger_entry` rows.
3. **Matching engine** runs against new `bank_transaction` rows, proposing matches (exact / fuzzy / aggregate) with a confidence indicator.
4. Client reviews proposals in the dashboard:
   - Confirms a match → **Allocation** module creates the corresponding `allocation` row(s).
   - Splits a transaction across categories/branches → **Allocation** module executes the split within a single atomic database transaction (`prisma.$transaction`) and validates the sum of portions before persisting.
5. **Reconciliation API** recomputes status per transaction and updates the dashboard (recorded vs. actual balance, % reconciled).

For v1, this flow is fully synchronous within a single request/response cycle — transaction volumes for a small business (dozens to low hundreds per month) don't justify async job processing yet. This is a candidate to revisit in Phase 2 if an aggregation match needs to scan a much larger transaction history.

---

## 5. Technology Stack

| Concern | Choice | Notes |
|---|---|---|
| Runtime / language | Node.js / TypeScript | Matches current professional stack |
| Framework | NestJS | Modular structure maps directly to the component boundaries above |
| Database | PostgreSQL | Relational integrity needed for the allocation-sum constraint; supports `CHECK` constraints and transactions |
| ORM | Prisma | Developer has prior hands-on experience from personal projects (not yet reflected on CV); type-safe client aids correctness of the allocation-sum logic; full rationale recorded in ADR |
| Validation | class-validator / Zod | To confirm in ADR |
| Testing | Jest | Unit tests required for Matching engine and Allocation validation logic specifically |
| Containerization | Docker + docker-compose | Local dev parity, and portfolio-relevant skill to demonstrate |
| CI/CD | GitHub Actions | Run tests + lint on every push; deploy pipeline as a stretch goal |
| Observability | Prometheus (`@willsoto/nestjs-prometheus`, `prom-client`) | Standard metrics format; correlation IDs for request tracing |

---

## 6. Deployment Topology (v1)

Single containerized NestJS application + single PostgreSQL instance. No load balancer, no queue, no cache layer — deliberately minimal for v1 given real usage scale (one business, a handful of accounts). This is documented explicitly so it's clear the simplicity is a deliberate choice for the current scale, not an oversight.

```
[ Client (browser) ] -> [ NestJS API (Docker container) ] -> [ PostgreSQL (Docker container) ]
```

---

## 7. Non-Functional Considerations

- **Data integrity over automation:** every allocation and match requires manual user confirmation in v1 (see PRD). This is a deliberate trade-off — trust is built incrementally with real financial data before considering any auto-confirm behavior.
- **Testability:** Matching engine and Allocation validation are the highest-risk logic in the system and are structured to be unit-testable independent of the framework and database.
- **Idempotency for financial mutations:** allocation requests support an optional idempotency key to prevent duplicate records from network retries.
- **Request correlation:** every request is assigned a UUID correlation ID for end-to-end tracing in structured logs.
- **API versioning:** all endpoints prefixed with `/api/v1/` to enable non-breaking future evolution.
- **Data sensitivity:** financial data from the real test user (business owner) must be anonymized before appearing in any public portfolio demo or repo.

---

## 8. Resolved Questions

The following questions from the original system design have been resolved:
- Allocation-sum constraint enforced at both application level AND database level (trigger with `FOR UPDATE` lock) — see ADR-003.
- CSV column-mapping uses explicit per-bank parser implementations (Strategy pattern) — see ADR-004.
- API versioning via global prefix `/api/v1/` — see ADR-011.
- Idempotency keys for allocation mutations — see ADR-012.
- Request correlation IDs for observability — see ADR-013.
- Prometheus metrics integration — see ADR-014.
- JWT secret management with no fallbacks — see ADR-015.

---

## 9. Code Abstractions & Patterns

### 9.1 `BankParser` Interface (Strategy Pattern)
To keep the **Import** module extensible for multiple bank statement formats without modifying core business logic (monetary amounts are returned as raw string representations from the file to avoid JavaScript floating-point rounding errors prior to `Decimal` conversion):

```typescript
export interface ParsedTransaction {
  txnDate: Date;
  amount: string;
  description: string;
  externalRef?: string;
}

export interface BankParser {
  parse(fileBuffer: Buffer): ParsedTransaction[];
}
```

Each bank implementation (e.g. `BcaCsvParser`, `MandiriCsvParser`) implements `BankParser`. Adding a new bank only requires creating a new parser class and registering it in the parser factory.

### 9.2 Atomic Split Operations (DB Transaction)
Split allocation operations write or update multiple `allocation` rows simultaneously. All split operations must be executed inside a single database transaction (`prisma.$transaction`) to guarantee atomicity: either all allocation portions persist successfully or none do, preventing partial/corrupted financial states.

### 9.3 Database Trigger Exception Handling
The Postgres database relies on triggers (like `check_allocation_sum`) that throw PL/pgSQL exceptions. These surface as Prisma error codes (`P2010` for raw query failures or `P2034` for transaction constraint violations). A `PostgresTriggerExceptionFilter` (`src/common/filters/postgres-trigger-exception.filter.ts`) intercepts these specific codes globally, maps them to domain exceptions (like `AllocationExceededError`), and returns an HTTP 400 Bad Request to prevent unhandled 500 errors from raw SQL constraints.

Unhandled exceptions fall through to a generic `500 Internal Server Error` response with a fixed message ("An unexpected error occurred. Please try again later.") — raw exception details, stack traces, and internal state are never returned to clients.

**Application-layer validation inside `prisma.$transaction`:** custom `Error` subclasses (e.g. `AllocationExceededError`) thrown inside async transaction callbacks never reach the global exception filter and degrade to HTTP 500. Application-layer cap validation therefore uses NestJS HTTP exceptions (`BadRequestException`) directly, which the framework's HTTP exception layer handles regardless of throw location (resolved DEF-A01, 2026-08-12).

### 9.4 DTO Validation
Incoming request payloads are validated with class-validator via a global `ValidationPipe` (`whitelist: true, transform: true`). Key bounds:
- `ImportCsvDto.bankFormat` is restricted with `@IsIn(['BCA', 'MANDIRI'])` — rejects unknown bank formats at the boundary instead of surfacing parser errors later.
- `RegisterDto.password` enforces `@MinLength(8)` with `@Matches(/(?=.*[A-Z])|(?=.*\d)/)` complexity rule. `RegisterDto.name` capped at `@MaxLength(255)`.
- `LoginDto.password` (and password fields across auth/users DTOs) is capped with `@MaxLength(128)` — bounds input size and rejects oversized payloads early.
- `CreateLedgerEntryDto.entryDate` validated via `@IsDateString()` — rejects non-ISO-8601 strings (e.g. `"banana"`) at the boundary before reaching the service layer.
- `CreateSingleAllocationDto.amountPortion` enforced as positive via `@IsPositive()` at DTO level and additional service-level `lte(0)` guard in `AllocationService` to reject zero/negative amounts even when nested DTO validation is bypassed.
