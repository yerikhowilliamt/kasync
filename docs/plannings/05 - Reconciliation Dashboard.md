# Fase 5: Reconciliation Dashboard

Context to attach: [PRD](./../00%20-%20PRD.md) (Section 5.4)

Implement the read-side reconciliation dashboard.

Tasks:
1. Dashboard summary endpoint: transaction counts across 4 statuses (UNRESOLVED, PENDING_REVIEW, PARTIALLY_ALLOCATED, MATCHED), recorded vs. actual balance, and the variance between them.
2. Filter support on the dashboard query: account, branch, category, date range, type (INFLOW/OUTFLOW), status.
3. Decide and confirm: minimal frontend for this phase, or API-only for
   now (this materially changes scope — confirm before building UI).
4. If building a frontend: simple views for statement upload, match
   review, split allocation, and the dashboard itself.
5. Write an end-to-end test covering the complete user journey: import
   a statement -> review and confirm matches -> allocate/split ->
   dashboard reflects the correct, updated numbers.

Definition of done: the numbers shown in the dashboard are verified
correct against a known test dataset via the e2e test, and the API (at
minimum) is usable without needing to inspect the database directly.
