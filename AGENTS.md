# AGENTS.md

## 1. AI Agent Workflow
- **Token Efficiency:** Be token-efficient; keep responses concise and avoid unnecessary scanning/explanation.
- **Scope Limit:** Read only relevant files/modules required for the task.
- **Implementation Plan:** For non-trivial tasks, provide an Implementation Plan with **at least 3 options** (with trade-offs and recommended option).
- **Approval Gate:** Stop and wait for explicit approval after presenting the plan before modifying code.
- **Completion Report:** List every file/folder **created** and **edited** with a short explanation of changes.
- **Task & Error Documentation:** Append completed task summary to `docs/TASK_LOG.md`. If an error occurs during execution, document the error message, root cause, and resolution in `docs/TROUBLESHOOTING.md`.
- **Phase Context Handover:** Before starting work on any task or phase, read the latest phase context file in `docs/phases/phase-XX-context.md`. Upon completing a task/phase, create or update `docs/phases/phase-XX-context.md` with key decisions, progress, state changes, and handover notes for future AI sessions.
- **Source Priority:** Task requirements > Approved ADRs > System Docs > Existing Code > AI Assumptions.

## 2. Repository State & Architecture
- **State:** Specification/docs phase (`README.md`, `docs/`). `src/` not yet generated.
- **Stack:** Node.js ≥20, TypeScript (`strict: true`, `noImplicitAny: true`), NestJS (modular monolith), PostgreSQL 16, Prisma ORM, Jest, `nestjs-pino`.
- **Modules:** `src/modules/import/`, `matching/`, `allocation/`, `accounts/`, `reconciliation/`, `common/`.
- **Boundaries:** No direct cross-module DB access. Inter-module communication strictly via exported services/interfaces.
- **Domain Purity:** `MatchingEngine` and `Allocation` math must be pure TS classes/functions with zero NestJS/Prisma/DB dependencies.

## 3. Financial & Database Invariants
- **Money Representation:** Always use `Decimal` (`decimal.js` or Prisma `Decimal`). Never raw JS `number`. Default rounding: `ROUND_HALF_EVEN` (Banker's Rounding).
- **Time & Timezone:** Store and process all timestamps/dates (`txnDate`, `entryDate`) in UTC (ISO-8601 UTC).
- **Allocation Invariant:** `sum(Allocation.amountPortion) <= BankTransaction.amount` for every transaction across all entrypoints.
- **Atomicity:** Multi-row allocation or financial updates must use `prisma.$transaction`.
- **Database Triggers:** Aggregate allocation cap (`check_allocation_sum` with `FOR UPDATE` lock) and status auto-sync (`sync_transaction_status`) enforced via SQL in `docs/database/migration.sql`.
- **Migration Gotcha:** `npx prisma migrate dev` does not auto-apply raw SQL triggers. Must run `npx prisma db execute --file ./docs/database/migration.sql` after migration.

## 4. Privacy, Security & Error Handling
- **GDPR & Privacy:** Synthetic data only in test/fixtures. No PII, bank account numbers, credentials, or raw bank statement text in logs.
- **Allowed Log Fields:** `txnId`, `amount` (as string), `status`, `processingTimeMs`, `errorCode`.
- **Domain Errors:** Throw domain exceptions with `Error` suffix (e.g. `AllocationExceededError`). Do not use NestJS HTTP exceptions in domain/services; map to HTTP status using global Exception Filters.
- **CSV Parsers:** Implement Strategy pattern via `BankParser` interface: `parse(fileBuffer): ParsedTransaction[]`.

## 5. Verification & Definition of Done
- **Focused Unit Test:** `npm run test -- path/to/spec.ts`
- **All Unit Tests:** `npm run test` (pure logic, zero DB, execution <1s, min 90% coverage).
- **Integration Tests:** `npm run test:e2e` (requires Postgres with applied triggers).
- **Typecheck & Lint:** `npx tsc --noEmit` && `npm run lint`.
- **Definition of Done:** Any data model change requires updating `schema.prisma`, `docs/database/migration.sql`, and relevant `docs/` in the same commit.
