# Engineering Playbook
## Cash Flow Reconciliation & Allocation Tool

**Status:** Active  
**Version:** 1.0  
**Target Audience:** Core Engineering  
**Last Updated:** August 2026

---

## 1. Core Engineering Philosophy

This project adheres to standard European engineering practices (Berlin/Amsterdam/London tech hub standards):

1. **Pragmatic Domain-Driven Design (DDD):** Core domain rules (matching algorithms, allocation math) are pure TypeScript, decoupled from frameworks (NestJS) and ORMs (Prisma).
2. **Data Integrity First:** Financial calculations must never rely solely on application logic. Database-level constraints (`CHECK` / triggers) are mandatory safety nets.
3. **GDPR & Financial Privacy by Design:** Zero raw financial identifiers or PII in application logs. Development and test environments use synthetic data exclusively.
4. **Shortest Working Diff:** Avoid premature abstractions. Follow the Ponytail principle: stdlib/native features first, interfaces only for genuine strategy variations (`BankParser`).

---

## 2. Code & Architecture Standards

### 2.1 Domain Separation & Module Boundaries
- **Framework Independence:** The `MatchingEngine` and `Allocation` validators must be plain TS classes/functions. They accept and return plain DTOs/Value Objects.
- **NestJS Modules:** Each domain (`Import`, `Matching`, `Allocation`, `Account`) lives in its own NestJS module.
- **Cross-Module Access:** Direct cross-module DB access is forbidden. Communication occurs strictly via exported module services or interfaces.

```
src/
  modules/
    import/          # CSV parsing, column-mapping config per bank
    matching/         # Matching engine — pure logic, framework-independent core
    allocation/       # Allocation CRUD + sum-validation logic
    accounts/         # Account management
    reconciliation/   # Read-side: dashboard queries, status aggregation
  common/              # Shared types, decorators, pipes
prisma/
  schema.prisma
  migrations/
test/
  unit/
  e2e/
```

### 2.2 Strict TypeScript & Code Quality
- `tsconfig.json` must enforce `strict: true` and `noImplicitAny: true`.
- Monetary amounts must be handled using `Decimal` (e.g. `decimal.js` or Prisma `Decimal`), **never raw JS numbers (`number`)** to prevent floating-point rounding errors.

### 2.3 Error Handling & Domain Exceptions
Define explicit domain errors instead of throwing generic NestJS `HTTPException` inside services:

```typescript
// Domain exception
export class AllocationExceededError extends Error {
  constructor(public readonly txnId: string, public readonly attempted: string, public readonly max: string) {
    super(`Allocation total (${attempted}) exceeds transaction ${txnId} maximum amount (${max})`);
  }
}
```
Map domain exceptions to HTTP responses in NestJS global Exception Filters. Specifically, the `PostgresTriggerExceptionFilter` (`src/common/filters/postgres-trigger-exception.filter.ts`) must catch Prisma errors `P2010` and `P2034` thrown by database triggers (e.g. `check_allocation_sum`) and convert them to `AllocationExceededError` yielding HTTP 400 Bad Request.

---

## 3. Data Privacy & Logging (GDPR Standard)

1. **Structured Logging:** Use structured JSON logger (e.g., `nestjs-pino`).
2. **PII Masking:** Never log account numbers, real bank descriptions, or owner details.
3. **Allowed Log Fields:** `txnId`, `amount` (as string), `status`, `processingTimeMs`, `errorCode`.

---

## 4. Testing Strategy

| Level | Target Scope | Technology | Requirement |
|---|---|---|---|
| **Unit Tests** | `MatchingEngine`, `BankParser` implementations, `Allocation` math | Jest | **Min 90% Coverage**, 0 DB dependency, fast execution (<1s). Required scenarios: exact match, fuzzy date tolerance, aggregate match, exact/under/over-allocation. |
| **Integration Tests** | `AllocationService` + Postgres triggers, Prisma queries | Jest + Testcontainers / Local Postgres | Verifies `prisma.$transaction` & DB trigger `check_allocation_sum` |
| **E2E Tests** | CSV Upload → Match → Split Allocation Flow | Supertest | Verifies full happy path via API controllers |

---

## 5. Git & Commit Workflow

- **Commit Format:** Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`).
- **Branch Strategy:** Short-lived feature branches (`feat/import-bca-parser`, `fix/allocation-trigger`) merged to `main`.
- **Pre-commit Rules:** Unit tests green (`npm run test`), Typecheck clean (`npx tsc --noEmit`), Linter clean (`npm run lint`).

## 6. Definition of Done
 
A task is only "done" when **all** of the following are true — not just "tests pass":
 
1. Code is merged to `main` via a self-reviewed branch (see Section 7 checklist).
2. Unit tests cover any new/changed business logic (`MatchingEngine`, `Allocation` math) — not just "tests exist," but tests that would actually fail if the logic broke.
3. CI is green (Section 8) — local pre-commit passing is necessary but not sufficient.
4. If the change altered the data model: `schema.prisma`, the corresponding migration, and any raw SQL (triggers) are all updated together, not left out of sync.
5. If the change involved a real decision with genuine alternatives (not just an implementation detail): an ADR entry exists.
6. If the change altered a documented behavior (API shape, module boundary, matching/allocation rule): the relevant doc (Technical Design, ERD, this Playbook, or the Handbook) is updated in the same PR — docs drift is treated as a bug, not a follow-up task.
---
 
## 7. Self-Review Checklist (solo-dev code review substitute)
 
Since there's no second engineer to open a pull request against, this checklist is the review — run it deliberately, ideally after a short break from the code (next session, not immediately after writing it):
 
- [ ] Does this change touch `MatchingEngine` or `Allocation`? If yes, is every new branch of logic covered by a test?
- [ ] Are all monetary values `Decimal`, with zero raw `number` arithmetic on amounts?
- [ ] Does every allocation write path go through the validated service — never a raw Prisma call that bypasses `AllocationExceededError` checks?
- [ ] Are domain exceptions used instead of generic `HttpException` inside services (Section 2.3)?
- [ ] Is any PII/raw financial identifier at risk of hitting a log line (Section 3)?
- [ ] Does the commit message and diff size make sense on their own, without needing verbal context?
- [ ] Does this change need an ADR, or an update to an existing doc?
---
 
## 8. CI Pipeline (GitHub Actions)
 
Pre-commit hooks (Section 5) are local and can be bypassed (`--no-verify`) — CI is the actual gate that can't be skipped. Minimum pipeline, on every push and PR:
 
1. Install dependencies.
2. `npx tsc --noEmit` (typecheck).
3. `npm run lint`.
4. `npm run test` (unit).
5. `npm run test:e2e` (against a Postgres service container in the CI job, with `migration.sql` applied).
A failing pipeline blocks merge to `main`. Deployment automation is out of scope for the CI pipeline itself — CI's job is the test gate, not delivery.
 
---
 
## 9. Naming Conventions
 
- **Files:** kebab-case (`matching-engine.service.ts`, `allocation.controller.ts`).
- **Classes / DTOs / Interfaces:** PascalCase (`AllocationExceededError`, `CreateAllocationDto`).
- **Variables / functions:** camelCase.
- **Domain exceptions:** suffix `Error` (`AllocationExceededError`), not `Exception` — reserve "Exception" naming for framework-level (NestJS) types to keep domain code visually distinct from framework code, consistent with Section 2.1's framework-independence rule.
---
 
## 10. API Documentation
 
Every controller endpoint is documented via `@nestjs/swagger` decorators (`@ApiOperation`, `@ApiResponse`, DTOs annotated with `@ApiProperty`). Swagger UI is exposed at `/docs` in non-production environments. This isn't optional polish — an undocumented API is a real gap for a portfolio project meant to be readable by someone who didn't build it.
 
---
 
## 11. Dependency Security
 
- `npm audit` runs as part of CI (informational at minimum; failing on high/critical severity is a reasonable bar for a financial-data project).
- Dependabot (or Renovate) enabled on the repo for automated dependency update PRs.
---
 
## 12. When an ADR Is Required
 
Not every decision needs an ADR — the trigger is genuine alternatives with real trade-offs, not implementation detail:
 
- **Requires an ADR:** choice of ORM, how the allocation-sum constraint is enforced, CSV import strategy, system shape (monolith vs. services) — decisions where a different reasonable engineer could have chosen differently, and the "why" matters later.
- **Does not require an ADR:** variable naming, which utility function to use, minor refactors that don't change behavior or public interfaces.
 