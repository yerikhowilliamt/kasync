# Phase 2 Context: Accounts & Import

## Key Decisions
- Implemented `AccountsModule` and `ImportModule` in NestJS structure.
- Used `csv-parse` for flexible CSV processing.
- Handled BCA and Mandiri CSV logic using the Strategy pattern (`BankParser` interface).
- De-duplication uses SHA-256 fallback when `externalRef` is not available.
- Added `PrismaModule` and `PrismaService` globally to prevent repeated imports.

## Progress
- Built Account CRUD service and controller.
- Built Import CSV service and controller using `multer`.
- Created robust BCA and Mandiri parsers.
- Complete fixture setup and 100% passing tests for the newly introduced code.

## State Changes
- New modules registered in `AppModule`.
- Typescript definitions enforced strictly.
- Pre-requisites complete for entering Phase 3.

## Handover Notes
- DB trigger handling for duplicate insertion relies on Prisma `skipDuplicates: true`. The combination of `accountId` and `externalRef` or `dedupHash` handles idempotency.
- If more banks are needed, create a new class implementing `BankParser` and add it to `ImportService` switch statement.
