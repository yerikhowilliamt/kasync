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
| **Import** | Parses uploaded CSV bank statements into normalized `bank_transaction` records via a unified `BankParser` interface (Strategy pattern per bank format). |
| **Matching engine** | Runs exact, fuzzy (date-tolerant), and aggregation matching between `bank_transaction` and `ledger_entry`. Pure business logic, no HTTP/DB dependency in its core so it can be unit tested in isolation. |
| **Allocation** | Manages the `allocation` junction records — creating splits inside a single database transaction (`prisma.$transaction`), validating that allocated portions sum to the transaction amount, tracking unresolved balances. |
| **Account** | Manages multiple bank/cash accounts per business, source-account tagging for every transaction. |
| **Reconciliation API / Dashboard** | Read-side: aggregates status (matched / pending review / needs allocation / unresolved), computes recorded vs. actual balance, serves the dashboard views. Proposed matches from matching engine are computed on-the-fly (stateless) or flagged as `PENDING_REVIEW` when user initiates allocation review. |

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
- **Data sensitivity:** financial data from the real test user (business owner) must be anonymized before appearing in any public portfolio demo or repo.

---

## 8. Open Questions (to resolve in ADR)

- Should the allocation-sum constraint be enforced at the database level (`CHECK`/trigger, added via a raw SQL Prisma migration) or only in application-level transaction logic, or both?
- CSV column-mapping: hardcode per-bank templates for the banks the test user actually uses, or build a generic mapping UI from day one?

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
