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

### [2026-08-09] TypeError: Cannot redefine property: compare in Jest Bcrypt Spies
- **Module / Area:** `auth`, `auth.service.spec.ts`
- **Error Message / Symptom:**
  ```text
  TypeError: Cannot redefine property: compare
      at ModuleMocker.spyOn (../node_modules/jest-mock/build/index.js:616:16)
      at Object.<anonymous> (modules/auth/auth.service.spec.ts:103:10)
  ```
- **Root Cause:** Attempting to `jest.spyOn(bcrypt, 'compare')` directly failed because `bcrypt` exports CJS non-configurable object properties.
- **Resolution:** Mocked the module top-level via `jest.mock('bcrypt')` and cast functions via `(bcrypt.compare as jest.Mock)`.
- **Prevention / Note:** Use `jest.mock('bcrypt')` when mocking native CJS crypto libraries in Jest unit tests.

### [2026-08-09] 401 Unauthorized in E2E Test Suites After Global JwtAuthGuard Integration
- **Module / Area:** `auth`, `test/allocation-split.e2e-spec.ts`, `test/reconciliation.e2e-spec.ts`
- **Error Message / Symptom:**
  ```text
  Expected 200/201, Received 401 Unauthorized across E2E test scenarios
  ```
- **Root Cause:** Replacing `ApiKeyGuard` with global `JwtAuthGuard` blocked test requests lacking an `access_token` HttpOnly cookie.
- **Resolution:** Added test user registration step (`POST /auth/register`) in `beforeAll` of E2E suites to capture the `access_token` cookie and attached `.set('Cookie', [authCookie])` to all API requests.
- **Prevention / Note:** Ensure all E2E API tests include valid user registration/login session cookies when protected by global auth guards.

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

### [2026-08-08] ts-node Module Not Found Error During Prisma Database Seeding
- **Module / Area:** `prisma`, `scripts`, `devops`
- **Error Message / Symptom:**
  ```text
  An error occurred while running the seed command:
  Error: Cannot find module './util'
  Require stack: - node_modules/.bin/ts-node
  ```
- **Root Cause:** Invoking global/standalone `ts-node` CLI binary directly via `npx prisma db seed` failed due to Node.js v24 CJS loader module resolution conflicts with `ts-node` internals.
- **Resolution:** Configured Prisma seed command in `package.json` to use Node's native module registration: `"prisma": { "seed": "node -r ts-node/register prisma/seed.ts" }`.
- **Prevention / Note:** Always execute TypeScript seed scripts via `node -r ts-node/register` when using Node >= 20 to avoid standalone `ts-node` CJS wrapper resolution errors.

### [2026-08-08] Generic Exception / Missing Entity DB Foreign Key Failure
- **Module / Area:** `allocation`, `allocation.service.ts`
- **Error Message / Symptom:**
  ```text
  Internal Server Error (500) when sending empty allocation payload or non-existent ledgerEntryId
  ```
- **Root Cause:** `AllocationService` threw generic `Error` on empty payloads and relied solely on PostgreSQL foreign key constraints for `ledgerEntryId`, producing raw DB errors mapped to 500 status.
- **Resolution:** Changed empty payload error to `BadRequestException` (400) and added explicit `tx.ledgerEntry.findUnique` check throwing `NotFoundException` (404) inside `prisma.$transaction`.
- **Prevention / Note:** Validate all foreign key entity existences and throw domain HTTP exceptions (`BadRequestException`, `NotFoundException`) before database mutation.
