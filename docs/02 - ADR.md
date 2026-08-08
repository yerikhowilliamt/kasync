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
