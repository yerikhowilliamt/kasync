# Architecture Decision Records (ADR)
## Cash Flow Reconciliation & Allocation Tool

Each record follows: Context → Decision → Consequences → Alternatives Considered.

---

## ADR-001: System shape — modular monolith

**Status:** Accepted
**Date:** August 2026

**Context:**
The system needs clear boundaries between distinct domains (import, matching, allocation, accounts) but is built and operated by a single developer, with a small, well-understood transaction volume (one business, dozens to low hundreds of transactions/month).

**Decision:**
Build as a modular monolith in NestJS — one deployable application, internally organized into separate modules per domain with explicit boundaries (no direct cross-module database access, only through module-exposed services).

**Consequences:**
- Positive: simple deployment (one container), no distributed-systems overhead (network calls, service discovery, distributed transactions), faster to build solo.
- Positive: module boundaries are still enforced in code, so a future split into services remains possible without a full rewrite.
- Negative: cannot scale individual components (e.g. the matching engine) independently of the rest of the app — acceptable given current transaction volume.

**Alternatives considered:**
- *Microservices per domain* — rejected. No current requirement justifies the operational overhead (service discovery, inter-service communication, distributed transaction handling for what should be one consistent data boundary — the allocation-sum invariant spans import, matching, and allocation, and is far simpler to enforce inside one database transaction than across services).

---

## ADR-002: ORM — Prisma

**Status:** Accepted
**Date:** August 2026

**Context:**
The developer's current job uses Sequelize, but has prior hands-on experience with Prisma from personal projects — experience not yet reflected on his CV or in any public portfolio work. The allocation-sum invariant (Section 4 of the Technical Design doc) benefits from strong type safety to reduce the risk of amount/type mismatches.

**Decision:**
Use Prisma as the ORM.

**Consequences:**
- Positive: generated, type-safe client reduces a class of bugs around amount/decimal handling in the allocation logic.
- Positive: declarative `schema.prisma` file is easy for an external reviewer (e.g. a recruiter or interviewer) to read and understand the data model at a glance.
- Positive: demonstrates a skill not currently visible on the developer's CV, backed by a real, working project.
- Negative: raw SQL / database-level constraints (e.g. `CHECK` constraints, triggers) need to be added via Prisma's raw migration escape hatch, since Prisma's schema language doesn't express them natively — adds a small amount of manual migration work.

**Alternatives considered:**
- *Sequelize* — rejected for this project specifically because it would only repeat existing, CV-documented work experience rather than demonstrating something new.
- *TypeORM* — rejected; weaker type-safety guarantees than Prisma, and no prior hands-on experience to draw on.

---

## ADR-003: Allocation-sum constraint enforcement & race condition guard

**Status:** Accepted
**Date:** August 2026

**Context:**
The core data-integrity rule of this system is that the sum of `amount_portion` across all `allocation` rows tied to one `bank_transaction` must never exceed that transaction's total amount (and should eventually equal it, for a fully resolved transaction). This is financial data — silent violations of this invariant would undermine the entire purpose of the tool. Furthermore, concurrent writes could lead to check-then-act race conditions (TOCTOU) if the database query checking current total does not acquire a lock.

**Decision:**
Enforce the constraint at **both** the application level and the database level:
- Application level: validate the running total inside an atomic transaction before persisting a new allocation, rejecting over-allocation with a clear error.
- Database level: add a trigger (`check_allocation_sum`) via raw SQL migration that acquires an explicit row lock (`SELECT amount FROM bank_transactions WHERE id = NEW.bank_transaction_id FOR UPDATE`) before checking `SUM(amount_portion)`, preventing concurrent race conditions.

**Consequences:**
- Positive: defense in depth — a bug in application logic or concurrent client requests cannot corrupt financial data.
- Positive: explicit row locking (`FOR UPDATE`) prevents check-then-act race conditions at the database level.
- Negative: slightly more implementation work; requires raw SQL migration alongside Prisma schema.

**Alternatives considered:**
- *Application-level only without DB locks* — rejected; vulnerable to concurrent write race conditions and missed code paths in bulk operations.
- *Database-level check constraint without FOR UPDATE* — rejected; standard PL/pgSQL trigger without locking parent row allows race conditions under READ COMMITTED isolation.

---

## ADR-004: CSV import strategy & parser abstraction

**Status:** Accepted
**Date:** August 2026

**Context:**
Bank statement CSV exports vary in column layout across banks (column names, date formats, sign conventions for debit/credit). Building a fully generic auto-detecting parser is a significant scope increase; the immediate real user (the friend whose problem motivated this project) uses a small, known set of banks.

**Decision:**
1. Start with **explicit, per-bank column-mapping configuration** (a small set of predefined mapping templates for the specific banks the test user actually uses), rather than a generic auto-detect/mapping-UI system.
2. Abstract the parsing logic behind a `BankParser` interface (Strategy pattern). Each bank format gets its own parser implementation (e.g. `BcaCsvParser`, `MandiriCsvParser`), decoupling bank-specific parsing code from the import service core.

**Consequences:**
- Positive: much smaller scope for v1 — a mapping config is a simple lookup, not a parsing/inference engine.
- Positive: directly serves the real user's actual banks first, rather than over-building for hypothetical future banks.
- Positive: code follows the Open/Closed Principle — adding support for a new bank requires adding a new `BankParser` implementation without editing existing import/matching logic.
- Negative: adding support for a new bank later requires a code change (a new mapping class) rather than being self-service for the end user — acceptable for v1 given there's a single real user.

**Alternatives considered:**
- *Generic mapping UI* (let any user map arbitrary CSV columns to fields) — deferred to a later phase; correctly identified as a feature for when/if the tool has multiple users with unknown bank formats, not a v1 requirement.

---

## ADR-005: Split allocation atomicity via DB transactions

**Status:** Accepted
**Date:** August 2026

**Context:**
A single bank transaction can be split into multiple allocations. Creating or updating multiple `allocation` rows non-atomically risks partial writes (e.g. 2 out of 3 allocations inserted before an error occurred), leaving financial records in an inconsistent state.

**Decision:**
Execute all multi-allocation write operations inside a single Prisma database transaction (`prisma.$transaction`).

**Consequences:**
- Positive: guarantees atomicity — all allocation rows for a split transaction either commit together or rollback completely on failure.
- Positive: works seamlessly with database triggers (ADR-003) to ensure total balance validations check against a fully committed batch.
- Negative: slight lock duration increase during transaction execution — negligible given low transaction volume.

**Alternatives considered:**
- *Per-row insert without transaction and manual rollback* — rejected; error-prone and leaves windows where orphaned partial allocations exist if application crashes mid-loop.

---

## ADR-006: Single-tenant and single-currency domain scope

**Status:** Accepted
**Date:** August 2026

**Context:**
The initial application target is a single small business operating in Indonesia using IDR across all branches and bank accounts. Multi-tenancy isolation and multi-currency exchange rate conversions add database and UI complexity.

**Decision:**
Assume single-tenant context and single-currency (IDR) for v1. Categories and Branches are unique globally across the business deployment.

**Consequences:**
- Positive: clean, uncluttered schema and domain logic without `tenant_id` or `currency_code` joins.
- Negative: scaling to SaaS multi-tenancy or multi-currency businesses will require schema migration to introduce `tenant_id` and rate fields later.

**Alternatives considered:**
- *Full SaaS multi-tenant schema with currency conversion engine* — rejected; over-engineering for v1 target persona.

---

## ADR-007: Fallback SHA-256 Deduplication Hash (`dedupHash`)

**Status:** Accepted
**Date:** August 2026

**Context:**
Some banks omit `externalRef` (transaction ID) in their CSV exports. We need a reliable way to deduplicate rows when `externalRef` is null, avoiding double imports of the same statement.

**Decision:**
Add `dedupHash` (SHA-256 hash of date, amount, description, type, and balance if available) to `BankTransaction`. Add unique constraint `@@unique([accountId, dedupHash])`. 

**Consequences:**
- Positive: allows safe re-imports for banks lacking transaction IDs.
- Negative: hash collision risk if two identical transactions occur on the exact same second/day (rare but possible). Application layer must handle these edge cases (e.g., manual override or sequence tracking).

**Alternatives considered:**
- *Rely solely on externalRef* — rejected; breaks for banks that do not provide it.

---

## ADR-008: Soft-Revoke Allocation Audit Trail

**Status:** Accepted
**Date:** August 2026

**Context:**
Allocations represent financial reconciliation decisions. Deleting them destroys the audit trail of who matched what, and when a mistake was un-matched.

**Decision:**
Use soft-revokes for Allocations. Add `status AllocationStatus @default(ACTIVE)` and `revokedAt DateTime?` to `Allocation`. Update DB triggers to only sum `ACTIVE` allocations.

**Consequences:**
- Positive: preserves history of reconciliation mistakes and corrections.
- Negative: DB triggers and application queries must explicitly filter by `status = 'ACTIVE'`.

**Alternatives considered:**
- *Hard delete allocations* — rejected; loses audit history.

---

## ADR-009: Dual-Token Authentication via HttpOnly Cookies & DB Refresh Store

**Status:** Accepted
**Date:** August 2026

**Context:**
The initial prototype relied on a static `x-api-key` header. The system requires secure multi-user registration and login with protected API routes. Authentication tokens stored in LocalStorage are vulnerable to XSS attacks.

**Decision:**
Implement JWT Dual-Token Authentication (`@nestjs/jwt`, `bcrypt`):
1. **Access Token:** Short lifetime (`1d`), sent via HttpOnly, SameSite cookie (`access_token`) and fallback `Authorization: Bearer` header.
2. **Refresh Token:** Long lifetime (`30d`), sent via HttpOnly cookie (`refresh_token`). A hashed version (`bcrypt`) is stored in `users.refresh_token_hash`.
3. **Refresh & Revocation:** `POST /auth/refresh` matches incoming cookie token with DB hash before issuing new Access Token. `POST /auth/logout` clears `refreshTokenHash` in DB and deletes cookies.

**Consequences:**
- Positive: Defense in depth against XSS (HttpOnly cookie), token revocation support via DB hash invalidation, explicit session renewal flow.
- Negative: Requires `cookie-parser` middleware and cookie-aware testing setups.

**Alternatives considered:**
- *LocalStorage JWT only* — rejected due to XSS vulnerability.
- *Server-side Sessions* — rejected to maintain stateless API capabilities for external clients.

---

## ADR-010: Centralized Storage Provider Interface & Cloudinary Implementation

**Status:** Accepted
**Date:** August 2026

**Context:**
The application requires file and media uploading capabilities across multiple domains (profile photos, statement attachments). Injecting concrete third-party services like `CloudinaryService` directly into domain services violates the Dependency Inversion Principle (DIP) and creates tight coupling to a single cloud vendor.

**Decision:**
1. Introduce an abstract storage interface `StorageProvider` in `src/common/storage/storage-provider.interface.ts` defining `uploadFile()` and `uploadImage()`.
2. Register `STORAGE_PROVIDER` injection token in `CloudinaryModule` pointing to `CloudinaryService`.
3. Inject `@Inject(STORAGE_PROVIDER)` into domain services (`UsersService`).
4. Validate incoming HTTP files on NestJS controller pipes using a custom `ImageMimeTypeValidator`.
5. Extract authenticated user details using custom NestJS param decorator `@ReqUser()`.

**Consequences:**
- Positive: Domain layer completely decoupled from Cloudinary SDK (DIP compliant), multi-cloud storage (S3/GCS) can be swapped seamlessly, clean NestJS controller layer without `req.user!.sub` non-null assertions.
- Negative: Extra interface and injection token abstraction.

---

## ADR-011: API Versioning via Global Prefix `/api/v1/`

**Status:** Accepted
**Date:** August 2026

**Context:**
The API has grown to 20+ endpoints across 10 modules. As the product evolves, breaking changes to request/response shapes are inevitable. Without versioning, clients must update simultaneously with every breaking change.

**Decision:**
Apply `app.setGlobalPrefix('api/v1')` in `main.ts`. All routes automatically receive the `/api/v1/` prefix. No per-controller changes needed. Swagger UI remains at `/docs`.

**Consequences:**
- Positive: Non-breaking future evolution via `/api/v2/` when needed. Standard REST practice. Zero per-controller code changes.
- Negative: All clients must update base URL once during migration. E2E tests require URL prefix updates.

**Alternatives considered:**
- *Header-based versioning (`Accept: application/vnd.kasync.v1+json`)* — rejected; more complex, less discoverable in Swagger, non-standard for REST APIs.
- *No versioning* — rejected; creates risk of breaking clients without migration path.

---

## ADR-012: Idempotency Keys for Financial Mutations

**Status:** Accepted
**Date:** August 2026

**Context:**
Network retries, client bugs, or user double-clicks can send duplicate `POST /allocations` requests. For financial data, duplicate allocations corrupt the allocation-sum invariant and create incorrect reconciliation states. The existing `FOR UPDATE` trigger prevents over-allocation but does not prevent creating two identical allocations from two separate requests.

**Decision:**
Add an optional `idempotencyKey String? @unique` field to the `Allocation` model. When a client includes `idempotencyKey` in the request, the service checks for an existing allocation with that key before creating. If found, returns the existing allocation (idempotent response). The key is optional — backward compatible.

**Consequences:**
- Positive: Safe retries without duplicate records. Client controls uniqueness scope. Optional — no impact on existing clients.
- Negative: Extra DB query per allocation with idempotency key. Unique constraint adds index overhead (negligible at current scale).

**Alternatives considered:**
- *Application-level deduplication only (no DB constraint)* — rejected; race conditions under concurrent requests could still create duplicates.
- *Composite unique constraint on (bankTransactionId, ledgerEntryId, amountPortion)* — rejected; too restrictive — same transaction can legitimately be allocated to the same ledger entry in separate operations (e.g., revoke + re-allocate).

---

## ADR-013: Request Correlation IDs

**Status:** Accepted
**Date:** August 2026

**Context:**
When diagnosing issues in production, engineers need to trace a single request across middleware, controllers, services, and database queries. Without a correlation ID, logs from different requests interleave and make debugging difficult.

**Decision:**
Add NestJS middleware that generates a UUID v4 for every incoming HTTP request and attaches it to `request.headers['x-correlation-id']`. If the client sends its own `X-Correlation-ID` header, it is preserved. The correlation ID is included in all `pino-http` structured log entries.

**Consequences:**
- Positive: End-to-end request tracing in logs. Client-supplied IDs enable distributed tracing across systems.
- Negative: Slight overhead per request (UUID generation is negligible). Middleware must be registered globally.

**Alternatives considered:**
- *No correlation IDs* — rejected; makes production debugging significantly harder.
- *OpenTelemetry distributed tracing* — deferred to Phase 2; overkill for single-service monolith at current scale.

---

## ADR-014: Prometheus Metrics Integration

**Status:** Accepted
**Date:** August 2026

**Context:**
The application lacks quantitative observability — there are no request rate, error rate, or latency metrics. For a financial system, knowing error rates and response times is critical for operational confidence.

**Decision:**
Integrate `@willsoto/nestjs-prometheus` with `prom-client`. The `PrometheusModule` registers automatically at `GET /metrics` in standard Prometheus text format. Default metrics (HTTP request duration, count, GC) are collected automatically.

**Consequences:**
- Positive: Industry-standard metrics format. Zero custom code for basic HTTP metrics. Compatible with Grafana, Datadog, and other Prometheus-compatible dashboards.
- Negative: New dependencies (`@willsoto/nestjs-prometheus`, `prom-client`). `/metrics` endpoint is unauthenticated (standard for internal metrics endpoints).

**Alternatives considered:**
- *Custom metrics service* — rejected; reinventing Prometheus client is wasteful.
- *No metrics* — rejected; operational blind spot for a financial system.

---

## ADR-015: JWT Secret Management — No Fallbacks

**Status:** Accepted
**Date:** August 2026

**Context:**
The initial implementation included hardcoded fallback secrets (`'fallback-access-secret-key'`, `'fallback-refresh-secret-key'`) used when `JWT_SECRET` or `JWT_REFRESH_SECRET` environment variables are missing. While a production guard existed (`NODE_ENV === 'production'`), a misconfigured `NODE_ENV` could silently use weak fallback keys, creating a security vulnerability.

**Decision:**
Remove all hardcoded fallback secrets. The application throws `UnauthorizedException` on startup if `JWT_SECRET` or `JWT_REFRESH_SECRET` are missing, in ALL environments (development, test, production).

**Consequences:**
- Positive: Impossible to run with weak/missing JWT secrets. Fail-fast behavior prevents silent security vulnerabilities.
- Negative: Developers must configure `.env` with real secret values before running locally. `.env.example` already contains placeholder values.

**Alternatives considered:**
- *Keep fallbacks with production-only guard* — rejected; `NODE_ENV` misconfiguration is a realistic failure mode.
- *Generate random secrets at startup* — rejected; tokens signed with random secrets are useless for refresh flows (server restart invalidates all refresh tokens).

