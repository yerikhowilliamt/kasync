# Fase 2: Accounts & Import

Context to attach: [PRD](./../00%20-%20PRD.md) (Section 5.1), [ERD](./../03%20-%20ERD.md), [ADR](./../02%20-%20ADR.md) (ADR-004), sample CSV file(s) from the actual bank(s) in use

Building on the existing foundation, implement the Account and Import
modules.

Tasks:
1. Account module: CRUD service + endpoints, with DTOs validated via
   class-validator. Account has a type (BANK, CASH, EWALLET).
2. Design a column-mapping config format for CSV bank statements — see
   ADR-004: this should be an explicit per-bank template, not a generic
   auto-detecting parser.
3. Implement the CSV parser for the attached sample bank format(s),
   returning ParsedTransaction with string amounts (never floating-point JS numbers) and transaction type (INFLOW/OUTFLOW), mapping columns to BankTransaction fields (txnDate, amount, type, description, externalRef).
4. Persist parsed rows as BankTransaction records, respecting the
   (accountId, externalRef) uniqueness constraint from the schema —
   re-uploading an overlapping statement must not create duplicates.
5. Build a CSV upload endpoint (multipart) that runs the full
   parse-and-persist flow.
6. Write unit tests for the parser using fixture CSV files: valid rows,
   duplicate rows, and malformed rows.

Definition of done: uploading a real (anonymized) statement produces
correct BankTransaction rows with no duplicates on re-upload, and the
parser has unit test coverage per the Engineering Playbook's testing
standards.
