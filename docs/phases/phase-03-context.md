# Phase 3 Context: Matching Engine

## Key Decisions
- Implemented `CategoriesModule`, `BranchesModule`, and `LedgerEntriesModule` as standard CRUD domain modules.
- Created `MatchingEngine` as a pure, framework-independent TypeScript class (`src/modules/matching/matching-engine.ts`) with zero NestJS/Prisma dependencies per Playbook business-logic isolation rules.
- `MatchingEngine` handles three match types:
  1. **Exact match**: 1 bank transaction to 1 ledger entry (same amount, same type, 0 days diff, confidence 1.0).
  2. **Fuzzy match**: 1 bank transaction to 1 ledger entry (same amount, same type, 1..dateToleranceDays diff, confidence 0.70-0.90).
  3. **Aggregation match**: N bank transactions ($2 \le N \le 4$) summing to 1 ledger entry amount within date window (confidence 0.70-0.85).
- Wrapped `MatchingEngine` inside NestJS `MatchingService` & `MatchingController` (`POST /matching/propose`).
- Proposed matches flag candidate `BankTransaction` records with status `PENDING_REVIEW`.

## Progress
- Built Category, Branch, LedgerEntry CRUD endpoints, DTOs, services, controllers, modules, and unit tests.
- Built framework-independent `MatchingEngine` core & unit tests covering exact, fuzzy, aggregation, date window boundaries, and ambiguous groupings.
- Exposed `POST /matching/propose` endpoint.
- 100% test pass rate across 16 test suites (69 tests). Clean `tsc` typecheck and `eslint` linting.

## State Changes
- `CategoriesModule`, `BranchesModule`, `LedgerEntriesModule`, and `MatchingModule` registered in `AppModule`.
- Updated proposed bank transactions status to `PENDING_REVIEW` upon proposal generation.

## Handover Notes
- `MatchingEngine` core is decoupled from NestJS/Prisma so it can be tested in isolation with fast unit tests.
- When confirming or allocating matches in Phase 4 (`Allocation`), status will transition from `PENDING_REVIEW` to `PARTIALLY_ALLOCATED` or `MATCHED`.
