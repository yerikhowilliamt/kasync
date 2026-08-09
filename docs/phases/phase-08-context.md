# Phase 8 Context Handover: Multi-Tenancy & Automated Database Triggers

## Key Decisions & Architecture Updates
- **Schema Multi-Tenancy**: Added `userId` (required, `@map("user_id")`) + `user` relation (`onDelete: Cascade`) + `@@index([userId])` to `Account`, `Category`, `Branch`, and `LedgerEntry` models in `prisma/schema.prisma`. Added `tokenValidFrom DateTime @default(now()) @map("token_valid_from")` to `User` model.
- **Prisma Migration**: Created `prisma/migrations/20260809180000_multi_tenancy_and_triggers/migration.sql` — single native Prisma migration that: (1) adds `user_id` columns, (2) creates a default system user for existing rows, (3) sets NOT NULL constraints, (4) creates indexes, (5) adds foreign keys, (6) embeds `check_allocation_sum` and `sync_transaction_status` PostgreSQL triggers. No longer requires manual `prisma db execute` step.
- **Token Revocation (Immediate Invalidation)**:
  - `AuthService.logout(userId)` now sets `tokenValidFrom = new Date()` alongside `refreshTokenHash = null`.
  - `JwtAuthGuard` checks `payload.iat * 1000 < user.tokenValidFrom.getTime()` — rejects with 401 if token was issued before revocation.
- **Magic Bytes Validation**: `ImageMimeTypeValidator.isValid()` now inspects raw file buffer (JPEG `FF D8 FF`, PNG `89 50 4E 47`, GIF `47 49 46 38`, WEBP `RIFF....WEBP`) before accepting upload, preventing MIME spoofing.
- **Multi-Tenant Authorization Scoping**: All core services (`AccountsService`, `CategoriesService`, `BranchesService`, `LedgerEntriesService`, `ImportService`, `AllocationService`) now require `userId` parameter on all CRUD methods. Controllers extract `userId` via `@ReqUser('sub')`. All queries scoped with `where: { userId }` or relational filters (`account: { userId }`).
- **Matching Engine Fixes**:
  - Fuzzy matching now includes 0-day differences: `diffDays >= 0 && diffDays <= opts.dateToleranceDays`.
  - `getSubsets()` sorts by amount-proximity to target before truncation (instead of static `slice(0, 20)`).
  - New `MatchingService.resetMatches(userId)` endpoint `POST /matching/reset` reverts `PENDING_REVIEW` → `UNRESOLVED`.
  - `MatchingService.proposeMatches()` now accepts optional `userId` for tenant-scoped matching.
- **CSV Parser Improvements**:
  - `MandiriCsvParser`: Handles Indonesian decimal format (`1.000.000,00`) vs English (`1,000,000.00`) via `normalizeDecimal()` helper.
  - `BcaCsvParser`: Supports `DD/MM/YY` short date formats, logs invalid row parse failures via `Logger`.
- **Reconciliation Dashboard**: `ReconciliationService.getDashboardSummary()` now accepts `userId`, scopes all queries. When filtering by `accountId`, `recordedLedgerBalance` computed exclusively from `LedgerEntry` rows linked via active allocations to that account's `BankTransaction` records.
- **CI/CD**: `.github/workflows/ci.yml` simplified — removed `prisma db execute` step since triggers are now embedded in the Prisma migration.

## Progress & Verification Status
- Branch: `feat/phase-08-multi-tenancy-triggers` (based on `dev`)
- `npx tsc --noEmit` — 0 errors
- `npm run test` — 123 passing unit tests (was 121; +2 from matching reset)
- E2E tests require running PostgreSQL with applied migration — verify via CI

## Completion Report
### Files Created
- `prisma/migrations/20260809180000_multi_tenancy_and_triggers/migration.sql` — multi-tenancy DDL + embedded triggers

### Files Edited
- `prisma/schema.prisma` — `userId` fields, relations, indexes on `Account`/`Category`/`Branch`/`LedgerEntry`; `tokenValidFrom` on `User`
- `src/common/guards/jwt-auth.guard.ts` — token revocation check via `tokenValidFrom`
- `src/common/validators/image-mimetype.validator.ts` — magic bytes inspection
- `src/modules/auth/auth.service.ts` — `logout()` sets `tokenValidFrom`
- `src/modules/accounts/accounts.service.ts` — tenant-scoped CRUD
- `src/modules/accounts/accounts.controller.ts` — `@ReqUser('sub') userId`
- `src/modules/accounts/accounts.service.spec.ts` — updated for userId
- `src/modules/categories/categories.service.ts` — tenant-scoped CRUD
- `src/modules/categories/categories.controller.ts` — `@ReqUser('sub') userId`
- `src/modules/categories/categories.service.spec.ts` — updated for userId
- `src/modules/categories/categories.controller.spec.ts` — updated for userId
- `src/modules/branches/branches.service.ts` — tenant-scoped CRUD
- `src/modules/branches/branches.controller.ts` — `@ReqUser('sub') userId`
- `src/modules/branches/branches.service.spec.ts` — updated for userId
- `src/modules/branches/branches.controller.spec.ts` — updated for userId
- `src/modules/ledger-entries/ledger-entries.service.ts` — tenant-scoped CRUD with category/branch ownership verification
- `src/modules/ledger-entries/ledger-entries.controller.ts` — `@ReqUser('sub') userId`
- `src/modules/ledger-entries/ledger-entries.controller.spec.ts` — updated for userId
- `src/modules/ledger-entries/ledger-entries.service.spec.ts` — updated for userId
- `src/modules/import/import.service.ts` — account ownership verification via `findFirst({ userId })`
- `src/modules/import/import.controller.ts` — `@ReqUser('sub') userId`
- `src/modules/import/import.service.spec.ts` — updated for userId
- `src/modules/allocation/allocation.service.ts` — `BankTransaction`/`LedgerEntry` ownership verification
- `src/modules/allocation/allocation.controller.ts` — `@ReqUser('sub') userId`
- `src/modules/matching/matching-engine.ts` — 0-day fuzzy match, amount-proximity subset sort
- `src/modules/matching/matching.service.ts` — tenant-scoped queries + `resetMatches()` endpoint
- `src/modules/matching/matching.controller.ts` — `POST /matching/reset` + `@ReqUser('sub') userId`
- `src/modules/reconciliation/reconciliation.service.ts` — tenant-scoped dashboard + allocation-linked ledger balance
- `src/modules/reconciliation/reconciliation.controller.ts` — `@ReqUser('sub') userId`
- `src/modules/import/parsers/mandiri-csv.parser.ts` — Indonesian/English decimal normalization
- `src/modules/import/parsers/bca-csv.parser.ts` — DD/MM/YY date format + parse failure logging
- `.github/workflows/ci.yml` — removed manual trigger SQL step
