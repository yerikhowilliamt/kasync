# Phase 9 Context Handover: QA Remediation — Critical + High Defect Fixes

## Summary
Professional QA review identified 18 defects (2 Critical, 6 High, 5 Medium, 5 Low). Phase 9 fixes 11 defects (all Critical + High + selected Medium). One QA-reported "defect" (DEF-008 Mandiri dedup) was verified as NOT a defect — `@@unique([accountId, externalRef])` already exists in init migration.

## Key Fixes Applied

### Critical
- **DEF-001 — Concurrent Allocation Race**: Added `SELECT id FROM bank_transactions WHERE id = ${txnId} FOR UPDATE` inside `prisma.$transaction` in `AllocationService.create()`. Locks the bank_transaction row before cap check, serializing concurrent allocation requests. Tagged template literal is parameterized by Prisma (no SQL injection). txnId validated as UUID at DTO layer.
- **DEF-008 — Mandiri Dedup**: Verified NOT a defect. `@@unique([accountId, externalRef])` exists in `prisma/migrations/20260808085205_init/migration.sql`. Mandiri transactions with `externalRef` are correctly deduplicated via `skipDuplicates: true` + unique constraint on `(accountId, externalRef)`.

### High
- **DEF-003 — Token Revocation Tolerance**: Changed from `payload.iat * 1000 < tokenValidFrom.getTime() - 2000` to `payload.iat * 1000 + 2000 < tokenValidFrom.getTime()`. Now correctly rejects tokens issued >2s before revocation (2s clock-skew tolerance). Also changed `payload.iat &&` to `payload.iat !== undefined` to handle iat=0 correctly.
- **DEF-004 — Idempotency Cross-User Leakage**: Replaced `allocation.findUnique({ idempotencyKey })` with user-scoped `findFirst({ idempotencyKey, bankTransaction: { account: { userId } } })`. Idempotency key lookup now scoped to requesting user's own allocations.
- **DEF-005 — Cap Check Over-Counts Idempotent Items**: Pre-resolves idempotent items into a `Map<string, AllocationRecord>` BEFORE cap calculation. Items with existing idempotency keys are excluded from `newItemsSum`, preventing false `AllocationExceededError` on retry with mixed idempotent+new items.
- **DEF-006 — Missing DTO on Reset**: Created `src/modules/matching/dto/reset-matches.dto.ts` with `@IsOptional() @IsUUID() accountId?`. Updated `MatchingController.reset()` to use `ResetMatchesDto` instead of untyped `{ accountId?: string }`.
- **DEF-007 — bankFormat Not Enum-Validated**: Changed `ImportCsvDto.bankFormat` from `@IsString()` to `@IsIn(['BCA', 'MANDIRI'])`. Invalid formats now rejected at validation layer before reaching `BankParserFactory`.
- **DEF-009 — No Import E2E Tests**: Created `test/import.e2e-spec.ts` (295 lines) with 11 scenarios covering happy path (BCA, Mandiri), re-import dedup (BCA dedupHash, Mandiri externalRef), cross-user account, invalid format, trailing space, file size limit, empty CSV, missing file, unauthenticated access.

### Medium
- **DEF-014 — Seed Raw Numbers**: Changed money fields in `prisma/seed.ts` from raw JS numbers to string literals per Decimal invariant.
- **DEF-015 — Cloudinary No Fail-Fast**: Added lazy env var validation in `CloudinaryService` — `ensureConfigured()` called on first `uploadFile()`, not at construction. Prevents app startup failure in test/CI environments without Cloudinary. Throws `BadRequestException` (not raw `Error`) when upload is attempted without config.
- **DEF-016 — LoginDto No MaxLength**: Added `@MaxLength(128)` to `LoginDto.password` matching `RegisterDto`.
- **DEF-017 — 500 Leaks Internal Error**: Changed `PostgresTriggerExceptionFilter` 500 fallback from raw `exception.message` to generic `'An unexpected error occurred. Please try again later.'`.

## Files Created
- `src/modules/matching/dto/reset-matches.dto.ts`
- `test/import.e2e-spec.ts`

## Files Edited
- `src/modules/allocation/allocation.service.ts` — FOR UPDATE lock + user-scoped idempotency + cap fix
- `src/modules/allocation/allocation.service.spec.ts` — $queryRaw mock + idempotency scoping + cap interaction tests
- `src/common/guards/jwt-auth.guard.ts` — revocation tolerance direction + iat guard
- `src/modules/matching/matching.controller.ts` — ResetMatchesDto wired
- `src/modules/matching/matching.controller.spec.ts` — reset endpoint test
- `src/modules/import/dto/import-csv.dto.ts` — @IsIn validation
- `src/modules/auth/dto/login.dto.ts` — @MaxLength(128)
- `src/common/cloudinary/cloudinary.service.ts` — lazy env check via `ensureConfigured()` on first upload
- `src/common/filters/postgres-trigger-exception.filter.ts` — masked 500 message
- `src/common/filters/postgres-trigger-exception.filter.spec.ts` — updated assertion
- `prisma/seed.ts` — string amounts
- `.gitignore` — added `.slim/deepwork/`
- `.ignore` — added deepwork read permissions

## Verification
- `npx tsc --noEmit` — 0 errors
- `npm run lint` — 0 errors
- `npm run test` — 133/133 passing (25 suites)

## Branch
`fix/qa-remediation` (commit `17b07b2`)
