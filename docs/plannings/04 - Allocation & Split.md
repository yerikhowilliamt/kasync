# Fase 4: Allocation & Split

Context to attach: [ADR](./../02%20-%20ADR.md) (ADR-003, ADR-005), [ERD](./../03%20-%20ERD.md) (Section 3.4)

Implement the Allocation module — this enforces the core data-integrity
guarantee of the whole system.

Tasks:
1. Allocation create endpoint, supporting append-only allocation writes (single allocation or multiple allocation portions for split cases). Enforce allocation immutability — zero direct updates to allocations; modifications require revoking and recreating allocations for strict auditability.
2. Application-level validation: reject any write where the sum of
   amount_portion for a bank transaction would exceed its amount. Use
   Decimal arithmetic throughout — never native floating point for money.
3. Write an integration test executing concurrent allocation writes directly via Prisma (bypassing service validation) to confirm that database trigger row-locking (FOR UPDATE) effectively prevents check-then-act race conditions (ADR-003).
4. Confirm the sync_transaction_status trigger correctly updates
   BankTransaction.status across all 4 statuses (UNRESOLVED / PENDING_REVIEW / PARTIALLY_ALLOCATED / MATCHED) on insert and delete of allocations.
5. Add endpoints to fetch all allocations for a given transaction, and
   all allocations for a given ledger entry (both directions of the
   junction).
6. Write an end-to-end test for the full split flow via the API.

Definition of done: over-allocation is impossible even via concurrent raw database writes, status updates automatically across 4 statuses, allocations are append-only/immutable, and the split flow is covered end-to-end.
