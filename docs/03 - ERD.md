# Database Schema (ERD)
## Cash Flow Reconciliation & Allocation Tool

**Status:** Draft v1.0
**Related:** [System_Design](./01%20-%20System_Design.md), [ADR](./02%20-%20ADR.md), [Schema Prisma](./database/schema.prisma), [Migration SQL](./database/migration.sql)
**Last updated:** August 2026

---

## 1. Entities

| Entity | Purpose |
|---|---|
| `Account` | A bank, cash, or e-wallet account belonging to the business. |
| `BankTransaction` | Atomic, immutable-in-practice record imported from a bank statement (has amount, type `INFLOW`/`OUTFLOW`, date, status). |
| `Category` | Expense/income category (e.g. raw materials, fuel). |
| `Branch` | Cost center / business branch. |
| `LedgerEntry` | A categorized manual record: category + branch + date + amount + type (`INFLOW`/`OUTFLOW`) + note. |
| `Allocation` | Junction between `BankTransaction` and `LedgerEntry`, carrying the portion of the amount allocated. |

Full column-level detail lives in `schema.prisma` — this document explains the *design decisions*, not just the columns.

---

## 2. Relationships

- `Account` 1 — N `BankTransaction`: one account has many imported transactions.
- `Category` 1 — N `LedgerEntry`, `Branch` 1 — N `LedgerEntry`: every ledger entry has exactly one category and one branch (no multi-category ledger entries — splitting across categories happens at the `Allocation` layer, not here).
- `BankTransaction` 1 — N `Allocation`, `LedgerEntry` 1 — N `Allocation`: this is the many-to-many bridge described in earlier discussion — a transaction can be split into multiple allocations, and a ledger entry can receive allocations from multiple transactions (the "3 small deposits = 1 manual entry" case).

---

## 3. Key Design Decisions

### 3.1 `externalRef` + unique constraint on `(accountId, externalRef)`
Bank CSV exports usually include some reference/transaction ID column. Storing it and enforcing uniqueness per account prevents the same statement row from being imported twice if a user re-uploads an overlapping date range — a real risk given manual CSV uploads.

### 3.2 `status` stored directly on `BankTransaction`, not computed on every read
`status` (`UNRESOLVED` / `PENDING_REVIEW` / `PARTIALLY_ALLOCATED` / `MATCHED`) is a denormalized, derived field. It could be computed on-the-fly by summing allocations, but for the reconciliation dashboard (which needs to filter/count by status frequently), a stored, trigger-maintained column is simpler to query and index. The trigger in `migration.sql` (`sync_transaction_status`) keeps it consistent automatically — the application layer never has to remember to update it.

### 3.3 `Decimal(18, 2)` and `type` (`INFLOW`/`OUTFLOW`) for amounts
Money is never stored as a floating-point type — `Decimal` avoids rounding errors. Furthermore, both `BankTransaction` and `LedgerEntry` specify `type` (`INFLOW` vs `OUTFLOW`) to enforce strict matching directionality.

### 3.4 The allocation-sum constraint lives in a trigger with explicit row locking
A standard PostgreSQL `CHECK` constraint can only validate columns within the same row — it cannot sum `amount_portion` across all `Allocation` rows for a given `bank_transaction_id`. That's why ADR-003's database-level enforcement is implemented as a `BEFORE INSERT OR UPDATE` trigger (`check_allocation_sum` in `migration.sql`) using `SELECT ... FOR UPDATE` on `bank_transactions` to lock the parent row and prevent race conditions.

### 3.5 No `category`/`branch` fields on `Allocation` itself
The category and branch live on `LedgerEntry`, not duplicated onto `Allocation`. This keeps a single source of truth: if a `LedgerEntry`'s category needs correcting, it's fixed in one place rather than needing to update every `Allocation` row that points to it.

---

## 4. Indexes

- `bank_transactions.txn_date`, `bank_transactions.status` — the dashboard's primary filters (date range, status).
- `ledger_entries.entry_date`, `.category_id`, `.branch_id` — supports filtering/reporting by category or branch.
- `allocations.bank_transaction_id`, `.ledger_entry_id` — both sides of the junction are queried frequently (show all allocations for a transaction; show all allocations for a ledger entry).

---

## 5. Open Item for the Development Phase

The `sync_transaction_status` trigger recomputes status from scratch on every allocation write. For the current expected volume (dozens to low hundreds of transactions/month) this is trivial in cost — worth revisiting only if the allocation table grows into the hundreds of thousands of rows per transaction range, which is not expected for this use case.
