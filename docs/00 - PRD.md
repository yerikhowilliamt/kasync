# Product Requirements Document
## Cash Flow Reconciliation & Allocation Tool

**Status:** Draft v1.0
**Author:** Yerikho William Tasilima
**Last updated:** August 2026

---

## 1. Problem Statement

Small business owners who keep manual cash flow records (spreadsheets, notebooks, or ad-hoc apps) routinely lose track of their real financial position because their internal records don't match their bank statements ("rekening koran"). This mismatch has three distinct root causes that compound each other:

1. **Timing gaps** — a transaction is recorded manually on one date but settles in the bank on a different date.
2. **Aggregated/split transactions** — a single manual entry actually corresponds to multiple small bank transactions (or vice versa), so a naive one-to-one match fails.
3. **Multi-purpose transfers** — a single bank transaction covers multiple expense categories and/or business units (e.g. one transfer pays for both raw materials and fuel, allocated across different branches), so the transaction can't be tagged with a single category.

The result: business owners can't trust their own cash position, can't tell whether money is missing or just miscategorized, and spend hours manually cross-checking bank mutations against notebooks or spreadsheets.

**Primary source of this problem:** direct interview with a small business owner (friend of the product owner) who manages multiple branches and expense categories from shared bank transfers.

---

## 2. Goals

- Let a business owner import their bank statement and manual records, and see clearly which entries match, which don't, and why.
- Support the reality that one bank transaction can fund multiple categories/branches (many-to-many allocation), not just simple 1-to-1 matching.
- Reduce the manual hours spent reconciling books against bank statements.
- Surface a trustworthy, accurate cash position at any point in time.

### Non-goals (out of scope for v1)

- Full accounting/bookkeeping system (no tax reporting, no invoicing, no payroll).
- Automatic bank integration via API/open banking (v1 relies on statement import, e.g. CSV).
- Cash flow forecasting/projection (candidate for a later phase, not v1).
- Mobile app (web only for v1).

---

## 3. Target User

**Primary persona: Owner-operator of a small multi-branch business**
- Runs a business with 2+ branches or cost centers.
- Currently tracks cash flow manually (Excel, notebook, or basic apps).
- Receives/sends transfers that often cover multiple expense categories in a single transaction.
- Is not an accountant; needs a simple interface, not double-entry bookkeeping jargon.

---

## 4. Core Concept: Data Model

The central design decision of this product is that a bank transaction and a categorized ledger entry are **not** a 1:1 relationship. They're connected through an **allocation** layer that supports 1:1, many:1, and 1:many relationships simultaneously.

**Entities:**

| Entity | Description |
|---|---|
| `bank_transaction` | Atomic, immutable record imported from a bank statement. Has date, amount, description, source account. |
| `ledger_entry` | A categorized business record: category (e.g. raw materials, fuel), branch/cost center, note. |
| `allocation` | Junction record linking one `bank_transaction` to one `ledger_entry`, with an `amount_portion`. Multiple allocations can point to the same bank transaction (split) or the same ledger entry (aggregation). |
| `account` | A bank account or cash source; supports multiple accounts per business. |

**Key invariant:** the sum of `amount_portion` across all allocations tied to a single `bank_transaction` must equal that transaction's total amount. This is the core validation rule that keeps the system trustworthy — under-allocation is flagged as "unresolved," over-allocation is blocked.

This single data model is designed to resolve all three root causes identified in Section 1:
- **Timing gaps** are handled at the matching stage (configurable date-tolerance window between a bank transaction and its proposed allocation).
- **Aggregated transactions** (e.g. 3 small cash deposits = 1 manual entry) are handled by allowing many `bank_transaction` rows to map to one `ledger_entry` via separate allocation rows.
- **Multi-category/multi-branch transfers** are handled by allowing one `bank_transaction` to be split across multiple `allocation` rows, each with its own category, branch, and portion of the amount.

---

## 5. Features (v1 / MVP scope)

### 5.1 Statement & record import
- Upload bank statement as CSV (start with CSV only; PDF parsing is a stretch goal, not MVP — bank PDF formats vary too much to be reliable in v1).
- Import or manually enter cash flow records (manual ledger entries).
- Support multiple accounts per business (bank + cash + e-wallet), each transaction tagged with its source account.

### 5.2 Matching engine
- Exact match: same amount, same/near date, one bank transaction to one ledger entry.
- Fuzzy match: configurable date-tolerance window (e.g. ±2 days) to handle settlement delays.
- Aggregation match: suggest grouping N small bank transactions against 1 manual entry when amounts sum correctly within a date window.
  - *Heuristics bound:* Max subset size of $N \le 4$ transactions per match. Max $\pm 3$ days tolerance. Identical transaction type required (INFLOW to INFLOW). Top 20 candidate combinations evaluated per search.
- Cross-account awareness: when a manual entry doesn't match in one account, check other accounts before flagging it as missing.

### 5.3 Split allocation
- User can split a single bank transaction into multiple `allocation` rows, each with its own category and branch/cost center.
- Real-time validation: running total of allocated portions vs. transaction amount, with clear indication of remaining unallocated balance.
- Predefined category list + branch/cost center list (configurable by the user).

### 5.4 Reconciliation dashboard
- Four-way status view per transaction:
  - **Matched**: bank transaction whose allocations sum exactly to its total amount.
  - **Pending Review**: matching engine proposed a candidate match, awaiting user confirmation.
  - **Needs Allocation / Partially Allocated**: bank transaction imported or partially allocated, awaiting split/categorization.
  - **Unresolved**: matching engine ran and found no candidate manual record — candidate for a truly missing or unrecorded transaction.
- Recorded balance vs. actual bank balance, with variance shown clearly.
- Filterable by account, branch, category, date range, and status.

### 5.5 Review & audit
- Every match/allocation is manually confirmed by the user before being marked final (no fully automatic reconciliation in v1 — trust is built incrementally).
- Immutable allocation records: allocations are append/revoke-only once created to maintain strict financial auditability. Audit trail tracks creation timestamp (`createdAt`).

### 5.6 Authentication & Access Control
- User registration (`POST /auth/register`) and authentication (`POST /auth/login`).
- Dual JWT token mechanism: Access Token (`1d` lifetime) stored in HttpOnly cookie and Refresh Token (`30d` lifetime) stored in HttpOnly cookie and hashed in PostgreSQL (`users.refresh_token_hash`).
- Refresh flow (`POST /auth/refresh`): Exchanges valid refresh cookie against DB hash to issue a new Access Token.
- Revocation / Logout (`POST /auth/logout`): Clears `refreshTokenHash` in DB and deletes authentication cookies.

---

## 6. Key User Flow

1. User uploads a CSV bank statement for a given account and date range.
2. System parses transactions and runs the matching engine against existing manual records.
3. User reviews suggested matches:
   - Confirms straightforward 1:1 matches.
   - For transactions needing a split, opens the split view, assigns category + branch + portion for each part, confirms when portions sum to the total.
   - For aggregated matches (many bank txns to one manual entry), confirms the grouping.
4. Transactions with no match are shown in the "Unresolved" queue for manual investigation or entry.
5. Dashboard updates to show recorded vs. actual balance and reconciliation completeness (% matched).

---

## 7. Success Metrics

- % of imported bank transactions reaching "Matched" status without manual data entry from scratch (matching engine effectiveness).
- Reduction in time to reconcile a month's worth of transactions (target: qualitative validation from the test user — the business owner interviewed).
- Zero tolerance for silent data loss: every imported bank transaction must end up in exactly one of Matched / Needs allocation / Unresolved — none can disappear.

---

## 8. Technical Considerations

- Suggested stack: NestJS + PostgreSQL (aligns with allocation model needing relational integrity/constraints), given this is also a skill-building project.
- The `amount_portion` sum constraint should be enforced at the database level (check constraint or transaction-level validation), not just in application code, to prevent data integrity issues.
- CSV parsing should be format-flexible from day one (different banks export different column layouts) — plan for a mapping/configuration step during import rather than hardcoding one bank's format.
- Financial data sensitivity: since real data from the interviewed business owner may be used for testing/demo, anonymize or use synthetic data for anything shown publicly in a portfolio.

---

## 9. Risks & Open Questions

- **PDF statement parsing** is explicitly deferred — confirm with real users whether CSV export is actually available from their bank, or whether PDF support becomes necessary sooner than planned.
- **Category/branch taxonomy** — needs to be defined per-business; v1 should let the user configure their own categories and branches rather than hardcoding a fixed list.
- **Matching engine tuning** — date-tolerance windows and aggregation heuristics will likely need iteration based on real transaction data from the test user.

---

## 10. Phased Rollout (suggested)

- **Phase 1 (MVP):** CSV import, manual entry, exact + fuzzy matching, split allocation, reconciliation dashboard for a single account.
- **Phase 2:** Multi-account support, aggregation matching, cross-account "missing" detection.
- **Phase 3 (stretch):** PDF statement parsing, cash flow forecasting, notifications/alerts.