
---

## ADR-017: Full Cascade Deletion
**Status:** Accepted
**Date:** August 2026

**Context:**
The initial schema design was missing `onDelete: Cascade` on critical foreign key relationships (`Account` -> `BankTransaction`, `BankTransaction` -> `Allocation`, `LedgerEntry` -> `Allocation`). This prevented users from deleting their accounts if they had any associated financial data, leading to a foreign key constraint violation (DEF-012).

**Decision:**
Apply `onDelete: Cascade` to all relevant downstream relationships from the `User` model. This ensures that when a user is deleted, all their associated accounts, bank transactions, ledger entries, and allocations are cleanly and atomically removed by the database.

**Consequences:**
- Positive: User account deletion now works as expected, even with existing financial data. Prevents orphaned records and maintains data integrity.
- Negative: Account deletion is now a highly destructive operation. This is the desired behavior for a user-initiated account closure.

**Alternatives considered:**
- *Soft-deletes for all models* — rejected as over-engineering for v1. `Allocation` already has a soft-revoke mechanism for audit purposes, which is sufficient.
- *Application-level manual deletion* — rejected; error-prone and less performant than a database cascade.

---

## ADR-018: Consistent Password Complexity Policy
**Status:** Accepted
**Date:** August 2026

**Context:**
The password complexity policy was inconsistent. `RegisterDto` required a minimum length and complexity (one uppercase or one digit), while `UpdatePasswordDto` only required a minimum length (DEF-011). This allowed users to weaken their passwords after registration.

**Decision:**
The `@Matches(/(?=.*[A-Z])|(?=.*\d)/)` validator and associated error message from `RegisterDto` will be applied to `UpdatePasswordDto.newPassword` to enforce a consistent policy across the application.

**Consequences:**
- Positive: Consistent security policy for passwords. Users cannot weaken their password below the initial complexity requirement.
- Negative: None.

**Alternatives considered:**
- *Removing complexity from registration* — rejected; weakens overall security posture for a financial application.

---

## ADR-019: Allocation Type Compatibility Enforcement
**Status:** Accepted
**Date:** August 2026

**Context:**
The allocation service allowed creating an allocation between a bank transaction and a ledger entry with mismatching types (e.g., INFLOW to OUTFLOW), which is semantically incorrect for reconciliation (DEF-002).

**Decision:**
`AllocationService` will now explicitly validate that `bankTransaction.type === ledgerEntry.type` before creating an allocation. If types mismatch, a `BadRequestException` is thrown.

**Consequences:**
- Positive: Prevents a class of user error and ensures all created allocations are semantically valid. Aligns the manual allocation flow with the matching engine's logic.
- Negative: Slightly more restrictive for the user, but this restriction is a core business rule of reconciliation.

**Alternatives considered:**
- *Allowing mismatch with a warning* — rejected; for financial data, it's better to be strict and prevent errors than to allow them with warnings.
