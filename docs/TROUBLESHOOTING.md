# Troubleshooting & Error Resolution Log

This document records errors encountered during development, their root causes, and verified resolutions.

---

## Template for New Entries

```markdown
### [YYYY-MM-DD] Error Title / Short Summary
- **Module / Area:** e.g., `allocation`, `prisma`, `docker`
- **Error Message / Symptom:**
  ```text
  Exact error output or stack trace excerpt
  ```
- **Root Cause:** Explanation of why it happened.
- **Resolution:** Step-by-step fix applied.
- **Prevention / Note:** How to prevent it from happening again.
```

---

## Log Entries

### [2026-08-08] Module Path Resolution Failure in E2E Jest Tests
- **Module / Area:** `allocation`, `test/e2e`
- **Error Message / Symptom:**
  ```text
  Cannot find module 'src/common/prisma/prisma.module' from '../src/modules/allocation/allocation.module.ts'
  ```
- **Root Cause:** Absolute import path `src/common/...` used in `allocation.module.ts` caused module resolution failure in Jest E2E runner when executed from `test/` directory.
- **Resolution:** Refactored module imports to use relative paths `../../common/prisma/prisma.module`.
- **Prevention / Note:** Use relative paths for intra-project module imports or ensure Jest `moduleNameMapper` is configured across unit and e2e configs.

### [2026-08-08] ESLint Unsafe Call & Member Access Errors in Prisma Service Mocks
- **Module / Area:** `allocation`, `allocation.service.spec.ts`
- **Error Message / Symptom:**
  ```text
  error  Unsafe call of an `any` typed value                      @typescript-eslint/no-unsafe-call
  error  Unsafe member access .ledgerEntry on an `any` value      @typescript-eslint/no-unsafe-member-access
  ```
- **Root Cause:** `mockPrismaService` was typed as `any`, causing TypeScript ESLint rules `@typescript-eslint/no-unsafe-call` and `@typescript-eslint/no-unsafe-member-access` to reject method access on dynamic mock objects.
- **Resolution:** Defined explicit `MockPrismaService` type interface for Jest mock objects instead of using untyped `any`.
- **Prevention / Note:** Always define typed mock interfaces for complex services like `PrismaService` in `.spec.ts` files.

### [2026-08-08] ESLint Unused Variables & Unsafe Any Access in CI Pipeline
- **Module / Area:** `reconciliation`, `import`, `ci`
- **Error Message / Symptom:**
  ```text
  error  'FileTypeValidator' is defined but never used             @typescript-eslint/no-unused-vars
  error  'service' is assigned a value but never used              @typescript-eslint/no-unsafe-vars
  error  Unsafe member access .importedCount on an `any` value     @typescript-eslint/no-unsafe-member-access
  ```
- **Root Cause:** Unused imports/variable declarations in controller and spec files, along with untyped Supertest response body assignments (`importRes.body.importedCount` and `dashRes.body.counts`) triggering strict ESLint rules in CI pipeline.
- **Resolution:** Removed unused variables and imports, and introduced explicit TypeScript interfaces (`ImportResponse` & `DashboardResponse`) for casting Supertest response bodies in `reconciliation.e2e-spec.ts`.
- **Prevention / Note:** Always run `npm run lint` locally before opening pull requests to ensure strict TypeScript-ESLint compliance.

### [2026-08-08] Generic Exception / Missing Entity DB Foreign Key Failure
- **Module / Area:** `allocation`, `allocation.service.ts`
- **Error Message / Symptom:**
  ```text
  Internal Server Error (500) when sending empty allocation payload or non-existent ledgerEntryId
  ```
- **Root Cause:** `AllocationService` threw generic `Error` on empty payloads and relied solely on PostgreSQL foreign key constraints for `ledgerEntryId`, producing raw DB errors mapped to 500 status.
- **Resolution:** Changed empty payload error to `BadRequestException` (400) and added explicit `tx.ledgerEntry.findUnique` check throwing `NotFoundException` (404) inside `prisma.$transaction`.
- **Prevention / Note:** Validate all foreign key entity existences and throw domain HTTP exceptions (`BadRequestException`, `NotFoundException`) before database mutation.
