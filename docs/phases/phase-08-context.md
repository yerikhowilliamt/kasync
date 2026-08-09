# Phase 8 Context Handover: Multi-Tenancy & Automated Database Triggers

## Key Decisions & Architecture Updates
- **Schema Multi-Tenancy**: Added `userId` (required, `@map("user_id")`) + `user` relation (`onDelete: Cascade`) + `@@index([userId])` to `Account`, `Category`, `Branch`, and `LedgerEntry` models in `prisma/schema.prisma`. Added `tokenValidFrom DateTime @default(now()) @map("token_valid_from")` to `User` model with inverse relations (`accounts`, `categories`, `branches`, `ledgerEntries`).
- **Schema Drift Resolution**: All `userId` fields and `tokenValidFrom` are now properly declared in `prisma/schema.prisma` — Prisma Client is fully type-safe with no schema/DB drift.
- **Prisma Migration**: Created `prisma/migrations/20260809180000_multi_tenancy_and_triggers/migration.sql` — single native Prisma migration that: (1) adds `user_id` columns, (2) creates a default system user for existing rows, (3) sets NOT NULL constraints, (4) creates indexes, (5) adds foreign keys, (6) embeds `check_allocation_sum` and `sync_transaction_status` PostgreSQL triggers. No longer requires manual `prisma db execute` step.
- **Token Revocation (Immediate Invalidation)**:
  - `AuthService.logout(userId)` now sets `tokenValidFrom = new Date()` alongside `refreshTokenHash = null`.
  - `JwtAuthGuard` verifies JWT, then queries `prisma.user.findUnique({ select: { tokenValidFrom: true } })` and rejects with 401 if `payload.iat * 1000 < user.tokenValidFrom.getTime()`.
- **Magic Bytes Validation**: `ImageMimeTypeValidator.isValid()` verifies: (1) declared mime type, (2) file extension, (3) magic bytes in file buffer — JPEG (`FF D8 FF`), PNG (`89 50 4E 47`), GIF (`47 49 46 38`), WEBP (`RIFF....WEBP` at offset 0/8). Prevents MIME spoofing attacks.
- **Multi-Tenant Authorization Scoping**: ALL services require `userId`:
  - **Accounts, Categories, Branches, LedgerEntries**: Controllers extract `userId` via `@ReqUser('sub')`. Services accept `userId` as separate parameter. Queries scoped with `where: { userId }` or relation-based ownership (`account: { userId }`). Create operations use `user: { connect: { id: userId } }`.
  - **Import**: `ImportService.importCsv()` verifies account ownership via `findFirst({ userId })`.
  - **Allocation**: `AllocationService` verifies `bankTransaction.account.userId` ownership on create/revoke/findByTransaction. LedgerEntry ownership verified on create. findByLedgerEntry scoped by `ledgerEntry.userId`.
  - **Matching**: `MatchingService.proposeMatches(userId, dto)` filters bank transactions by `account: { userId }` and ledger entries by `userId`. `updateMany` scoped by `account: { userId }`.
  - **Reconciliation**: `ReconciliationService.getDashboardSummary(userId, query)` scopes both `bankTxnWhere` and `ledgerWhere` by userId.
- **Matching Engine Fixes**:
  - Fuzzy matching starts from 1-day diff (0-day is exact match): `diffDays > 0 && diffDays <= opts.dateToleranceDays`.
  - `getSubsets()` caps candidate pool at 20 items to prevent combinatorial explosion.
  - New `MatchingService.resetMatches(userId, accountId?)` method reverts `PENDING_REVIEW` → `UNRESOLVED`, scoped by userId.
  - New `POST /matching/reset` endpoint in `MatchingController`.
- **CSV Parser Improvements**:
  - `MandiriCsvParser`: Handles Indonesian decimal format (`1.000.000,00`) vs English (`1,000,000.00`) via `normalizeDecimal()` helper.
  - `BcaCsvParser`: Supports `DD/MM/YY` short date formats, logs invalid row parse failures via `Logger`.
- **Reconciliation Dashboard**: `ReconciliationService.getDashboardSummary()` accepts `userId`, scopes all queries. When filtering by `accountId`, `recordedLedgerBalance` computed exclusively from `LedgerEntry` rows linked via active allocations to that account's `BankTransaction` records.
- **CI/CD**: `.github/workflows/ci.yml` simplified — removed `prisma db execute` step. Triggers are now automatically applied by `npx prisma migrate deploy`.
- **DTO Cleanup**: Removed optional `userId` from user-facing DTOs (`CreateAccountDto`, `CreateCategoryDto`, `CreateBranchDto`, `CreateLedgerEntryDto`). UserId is extracted from JWT via `@ReqUser('sub')` and passed as a separate service parameter — never from request body.

## Progress & Verification Status
- Branch: `feat/phase-08-multi-tenancy-triggers` (based on `dev`)
- `npx prisma generate` — Prisma Client regenerated, fully type-safe
- `npx tsc --noEmit` — 0 errors
- `npm run test` — 129 passing unit tests (was 121; +8 from matching reset + magic bytes + guard tests)
- E2E tests require running PostgreSQL with applied migration — verify via CI

## Completion Report
### Files Created
- `prisma/migrations/20260809180000_multi_tenancy_and_triggers/migration.sql` — multi-tenancy DDL + embedded triggers

### Files Edited
- `prisma/schema.prisma` — `userId` fields, relations, indexes on `Account`/`Category`/`Branch`/`LedgerEntry`; `tokenValidFrom` + inverse relations on `User`
- `prisma/seed.ts` — updated to use `userId` scalar FK pattern for Account/Category/Branch and relation connect for LedgerEntry
- `src/common/guards/jwt-auth.guard.ts` — token revocation check via `tokenValidFrom` + `PrismaService` injection
- `src/common/validators/image-mimetype.validator.ts` — magic bytes inspection (JPEG, PNG, GIF, WEBP signatures)
- `src/common/validators/image-mimetype.validator.spec.ts` — 11 test cases covering valid signatures, spoofing, empty/missing buffers
- `src/modules/auth/auth.service.ts` — `logout()` sets `tokenValidFrom = new Date()`
- `src/modules/auth/auth.service.spec.ts` — updated logout test to expect `tokenValidFrom`
- `src/modules/accounts/accounts.service.ts` — tenant-scoped CRUD with `user: { connect }` pattern
- `src/modules/accounts/accounts.controller.ts` — `@ReqUser('sub') userId`
- `src/modules/accounts/accounts.service.spec.ts` — updated for relation connect pattern
- `src/modules/accounts/dto/create-account.dto.ts` — removed optional `userId` from DTO
- `src/modules/categories/categories.service.ts` — tenant-scoped CRUD
- `src/modules/categories/categories.controller.ts` — `@ReqUser('sub') userId`
- `src/modules/categories/categories.service.spec.ts` — updated for relation connect pattern
- `src/modules/categories/dto/create-category.dto.ts` — removed optional `userId` from DTO
- `src/modules/branches/branches.service.ts` — tenant-scoped CRUD
- `src/modules/branches/branches.controller.ts` — `@ReqUser('sub') userId`
- `src/modules/branches/branches.service.spec.ts` — updated for relation connect pattern
- `src/modules/branches/dto/create-branch.dto.ts` — removed optional `userId` from DTO
- `src/modules/ledger-entries/ledger-entries.service.ts` — tenant-scoped CRUD with relation connects + category/branch ownership verification
- `src/modules/ledger-entries/ledger-entries.controller.ts` — `@ReqUser('sub') userId`
- `src/modules/ledger-entries/ledger-entries.controller.spec.ts` — updated for userId
- `src/modules/ledger-entries/ledger-entries.service.spec.ts` — updated for relation connect pattern
- `src/modules/ledger-entries/dto/create-ledger-entry.dto.ts` — removed optional `userId` from DTO
- `src/modules/import/import.service.ts` — account ownership verification via `findFirst({ userId })`
- `src/modules/import/import.controller.ts` — `@ReqUser('sub') userId`
- `src/modules/import/import.service.spec.ts` — updated for userId
- `src/modules/allocation/allocation.service.ts` — `BankTransaction`/`LedgerEntry` ownership verification via relation queries + `userId` parameter on all methods
- `src/modules/allocation/allocation.controller.ts` — `@ReqUser('sub') userId` on all endpoints
- `src/modules/allocation/allocation.service.spec.ts` — updated for userId parameter
- `src/modules/matching/matching-engine.ts` — 0-day fuzzy match fix, max 20 candidate pool cap
- `src/modules/matching/matching.service.ts` — tenant-scoped queries + `resetMatches(userId, accountId?)` method
- `src/modules/matching/matching.controller.ts` — `POST /matching/reset` endpoint + `@ReqUser('sub') userId` on propose
- `src/modules/reconciliation/reconciliation.service.ts` — tenant-scoped dashboard + `userId` parameter on `getDashboardSummary`
- `src/modules/reconciliation/reconciliation.controller.ts` — `@ReqUser('sub') userId`
- `src/modules/import/parsers/mandiri-csv.parser.ts` — Indonesian/English decimal normalization
- `src/modules/import/parsers/bca-csv.parser.ts` — DD/MM/YY date format + parse failure logging
- `.github/workflows/ci.yml` — removed redundant `prisma db execute` step
