# Fase 3: Matching Engine

Context to attach: [System Design](./../01%20-%20System_Design.md) (Section 3), [Engineering Playbook](./../04%20-%20Engineering_Playbook.md) (Section 4)

Implement Category, Branch, LedgerEntry modules, then the matching
engine — the highest-risk, most test-critical part of this system.

Tasks:
1. Category and Branch: simple CRUD modules.
2. LedgerEntry: CRUD + DTOs (category, branch, entryDate, amount, type: INFLOW/OUTFLOW, note).
3. Design the matching engine as a plain, framework-independent
   TypeScript module (no NestJS decorators, no direct Prisma/HTTP
   dependency in the core logic) per the Playbook's business-logic
   isolation rule. Wrap it in a thin NestJS service.
4. Implement exact match: same amount, same type (INFLOW/OUTFLOW), same date.
5. Implement fuzzy match: configurable date-tolerance window.
6. Implement aggregation match: N bank transactions summing to one
   ledger entry within a date window. (Heuristics bound: max subset $N \le 4$, max $\pm 3$ days window, identical INFLOW/OUTFLOW type, evaluate top 20 candidates).
7. Expose a "propose matches" endpoint that runs all three match types,
   returns candidates with a match-type/confidence indicator, and updates proposed BankTransaction statuses to PENDING_REVIEW.
8. Write unit tests for every match type, including edge cases (no
   match found, boundary of the date-tolerance window, ambiguous
   aggregation groupings).

Definition of done: given a set of bank transactions and ledger entries,
the engine proposes correct matches, updates proposed transaction statuses to PENDING_REVIEW, and every match type has dedicated
unit test coverage — no PR merges here without tests, per the Playbook.
