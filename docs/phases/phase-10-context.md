# Phase 10 Context Handover: QA Remediation — Raise Quality Score to 9/10

## Summary
Professional QA assessment identified 16 valid defects (1 Critical, 7 High, 5 Medium, 3 Low). Phase 10 resolves all of them. Target: raise QA score from 6.0/10 to ≥ 9.0/10.

## Key Fixes Applied

### Logic Fixes (Tasks 1-6)
1. **Matching Engine Calendar-Day Diff (DEF-006)**: `getDateDiffDays()` now uses `Date.UTC()` calendar-date comparison instead of wall-clock ms division. Midnight-straddling timestamps now correctly produce FUZZY (diff=1) instead of incorrect EXACT (diff=0).
2. **MatchingService Date-Windowed Fetch (DEF-008)**: `ledgerEntry.findMany` scoped to `min(txnDate) - tolerance` to `max(txnDate) + tolerance`. Empty bankTxns returns `[]` immediately.
3. **findByLedgerEntry Cross-User Scope (DEF-001)**: Added `bankTransaction: { account: { userId } }` to where clause.
4. **Revoke Already-REVOKED Guard (DEF-010)**: Throws `BadRequestException` if `allocation.status === REVOKED`.
5. **Ledger Delete Active Alloc Guard (DEF-011)**: Checks `allocation.count({ status: ACTIVE })` before delete. Returns 409 Conflict.
6. **Dashboard Balance Variance (DEF-015)**: `balanceWhere` (ignores status filter) separated from counts `where` (uses status filter).

### DTO & Security Fixes (Tasks 7-10)
7. **entryDate Validation (DEF-014)**: `@IsString()` → `@IsDateString()` on `CreateLedgerEntryDto.entryDate`.
8. **Password Policy (DEF-012/021)**: `@MinLength(8)` + `@Matches(/(?=.*[A-Z])|(?=.*\d)/)`. Name `@MaxLength(255)`.
9. **Auth Rate Limiting (DEF-013)**: `@Throttle({ ttl: 60000, limit: 10 })` on login + register. Global 100 req/min unchanged.
10. **idempotencyKey Composite Scope (DEF-P2-05)**: `@@unique([bankTransactionId, idempotencyKey])`. Prisma migration `fix_idempotency_key_scope`.

### Test Fixes (Tasks 11-20)
11. **Matching Engine Unit Tests**: 7 new cases — midnight-straddle, empty inputs, tolerance boundaries, 21+ txns.
12. **Allocation Service Tests**: Refactored `$transaction` mock to use separate `txMock`. Added FOR UPDATE lock assertion, exact-cap test, revoke-already-revoked test.
13. **Ledger Entries Tests**: Active allocation guard test.
14. **Matching Service Tests**: Date-windowed fetch assertion.
15. **E2E: Concurrent Allocation** (`allocation-concurrent.e2e-spec.ts`): HTTP-layer concurrency via `Promise.allSettled`.
16. **E2E: Authorization** (`authorization.e2e-spec.ts`): Cross-user allocation blocked, post-logout token rejected, concurrent registration.
17. **E2E: Allocation Boundaries** (`allocation-boundary.e2e-spec.ts`): Revoke idempotency, amountPortion=0/-100, ledger delete guard.
18. **E2E: Trigger Cleanup** (`allocation-trigger.e2e-spec.ts`): Array-based ID tracking for reliable afterAll cleanup.

### Docs (Task 21)
19. **ADR-016**: Documented `idempotencyKey` composite uniqueness decision.
20. **ERD + schema.prisma**: Synced with live schema.

## Files Created
- `test/allocation-concurrent.e2e-spec.ts`
- `test/authorization.e2e-spec.ts`
- `test/allocation-boundary.e2e-spec.ts`
- `docs/plannings/10 - QA Remediation.md`
- `docs/phases/phase-10-context.md`
- Prisma migration `fix_idempotency_key_scope`

## Files Edited
- `src/modules/matching/matching-engine.ts` — calendar-day diff
- `src/modules/matching/matching.service.ts` — date-windowed ledger fetch
- `src/modules/allocation/allocation.service.ts` — findByLedgerEntry scope, revoke guard
- `src/modules/ledger-entries/ledger-entries.service.ts` — delete guard + AllocationStatus import
- `src/modules/ledger-entries/dto/create-ledger-entry.dto.ts` — @IsDateString
- `src/modules/auth/dto/register.dto.ts` — MinLength(8), @Matches, name MaxLength(255)
- `src/modules/auth/auth.controller.ts` — @Throttle on login + register
- `prisma/schema.prisma` — idempotencyKey composite unique
- `src/modules/allocation/allocation.service.spec.ts` — txMock refactor + new tests
- `src/modules/matching/matching-engine.spec.ts` — 7 new unit tests
- `src/modules/matching/matching.service.spec.ts` — date-window tests
- `src/modules/ledger-entries/ledger-entries.service.spec.ts` — delete guard tests
- `test/allocation-trigger.e2e-spec.ts` — array-based cleanup
- `docs/02 - ADR.md` — ADR-016
- `docs/03 - ERD.md` — composite constraint
- `docs/database/schema.prisma` — sync
- `docs/TASK_LOG.md` — Phase 10 entry

## Verification
- `npx tsc --noEmit` — 0 errors
- `npm run lint` — 0 errors
- `npm run test` — 148/148 passing (25 suites)
- E2E tests: Created, require PostgreSQL. Verified structurally via tsc.

## Branch
`fix/qa-remediation` (pending commit)
