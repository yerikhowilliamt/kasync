# Phase 4: Allocation Engine Context

## State
- **Status**: Completed
- **Branch**: merged into `dev`

## Architecture/Implementation Notes
- Uses raw SQL database triggers (`migration.sql`) directly rather than Prisma middleware to ensure bulletproof data integrity, particularly around exact summation caps (`amountPortion` vs `amount`) in high concurrency environments.
- Enforces strict row locking using PostgreSQL `FOR UPDATE` inside `check_allocation_sum()` to prevent check-then-act race conditions across concurrent multi-client requests creating allocations on the same `bankTransactionId`. 
- P2010 Prisma errors thrown by the triggers are mapped to domain HTTP 400 bad request errors dynamically using `PostgresTriggerExceptionFilter`.
- Recomputing the state of `BankTransaction` (`UNRESOLVED`, `PARTIALLY_ALLOCATED`, `MATCHED`) happens synchronously and atomically after any INSERT, UPDATE, or DELETE via `sync_transaction_status` trigger instead of application layer tracking to ensure the UI state is never out of sync with actual DB constraints.

## Next Phase Requirements (Phase 5: Reconciliation)
- Depend on `PARTIALLY_ALLOCATED` or `MATCHED` states verified safely here to close the loop on reconciliation workflows.
