# Kasync

**Kasync** — sync your books with your bank. Cash flow reconciliation & multi-category allocation tool for small businesses, built with NestJS, PostgreSQL, and Prisma.

---

## The Problem

Small business owners who track cash flow manually (spreadsheets, notebooks) routinely lose track of their real financial position because their internal records don't match their bank statements. Three things usually cause this:

- **Timing gaps** — a transaction is recorded on one date but settles in the bank on another.
- **Aggregated transactions** — one manual entry actually corresponds to several small bank transactions, or vice versa.
- **Multi-purpose transfers** — a single bank transaction covers multiple expense categories and/or branches (e.g. one transfer pays for both raw materials and fuel, split across cost centers).

Kasync was built to solve this for a real small business, and is designed around a single data model that handles all three cases at once — not three separate patches.

## Key Features

- **CSV bank statement import**, with per-bank column mapping.
- **Matching engine**: exact match, date-tolerant fuzzy match, and aggregation match (many small transactions → one manual record).
- **Split allocation**: a single bank transaction can be divided across multiple categories and branches, with the allocation sum validated both in the application layer and at the database level.
- **Reconciliation dashboard**: recorded vs. actual balance, variance, and status breakdown (matched / needs allocation / unresolved), filterable by account, branch, category, and date range.
- **Multi-account support**: bank, cash, and e-wallet accounts in one view.

## Tech Stack

| Layer | Choice |
|---|---|
| Language / runtime | TypeScript / Node.js |
| Framework | NestJS (modular monolith) |
| Database | PostgreSQL |
| ORM | Prisma |
| Testing | Jest |
| Containerization | Docker & docker-compose |
| CI | GitHub Actions |

## Architecture

Kasync is a modular monolith, not microservices — one deployable service internally split into domain modules (`import`, `matching`, `allocation`, `account`, `reconciliation`). The core insight of the data model: a bank transaction and a categorized ledger entry are connected through an **allocation** junction, not directly — this is what allows one transaction to be split across categories/branches, and multiple small transactions to aggregate into one manual entry, using a single consistent model instead of separate mechanisms.

The allocation-sum invariant (allocated portions can never exceed a transaction's amount) is enforced twice: once in application code, and once by a PostgreSQL trigger — so a bug in the app layer can't silently corrupt financial data.

Full design rationale: see [`docs/01 - System_Design.md`](docs/01%20-%20System_Design.md) and [`docs/02 - ADR.md`](docs/02%20-%20ADR.md).

## Getting Started

**Prerequisites:** Node.js (LTS), Docker & docker-compose.

```bash
git clone https://github.com/<your-username>/kasync.git
cd kasync
npm install
cp .env.example .env        # set DATABASE_URL and any other required vars
docker-compose up -d        # starts local PostgreSQL
npx prisma migrate dev      # applies schema + migrations
npm run db:seed             # optional, seeds sample categories/branches/accounts
npm run start:dev
```

**Running tests:**

```bash
npm run test          # unit tests
npm run test:e2e      # e2e tests (requires the docker-compose DB running)
```

## Project Structure

```
src/
├── modules/
│   ├── import/         # CSV parsing, per-bank column mapping
│   ├── matching/        # Matching engine (exact, fuzzy, aggregate)
│   ├── allocation/      # Allocation CRUD + validation
│   ├── account/         # Account management
│   └── reconciliation/  # Dashboard read-side, status aggregation
│
├── common/            # Shared types, decorators, pipes
│
prisma/
├── schema.prisma
├── migrations/
│
test/
├── unit/
├── e2e/
```

## Documentation

| Doc | Covers |
|---|---|
| [`docs/00 - PRD.md`](docs/00%20-%20PRD.md) | Product requirements and scope |
| [`docs/01 - System_Design.md`](docs/01%20-%20System_Design.md) | System architecture and component design |
| [`docs/02 - ADR.md`](docs/02%20-%20ADR.md) | Key technical decisions and their rationale |
| [`docs/03 - ERD.md`](docs/03%20-%20ERD.md) | Database schema and data model design |
| [`docs/04 - Engineering_Playbook.md`](docs/04%20-%20Engineering_Playbook.md) | Coding conventions, branching, testing, and review standards |
| [`docs/05 - Project_Handbook.md`](docs/05%20-%20Project_Handbook.md) | Onboarding guide for the codebase |

## Roadmap

- [ ] **Phase 1** — Foundations (project setup, schema, CI)
- [ ] **Phase 2** — Accounts & import
- [ ] **Phase 3** — Matching engine
- [ ] **Phase 4** — Allocation & split
- [ ] **Phase 5** — Reconciliation dashboard
- [ ] **Phase 6** — Polish & portfolio readiness

Stretch goals (post-v1): PDF statement parsing, cash flow forecasting, automated alerts.

## Contributing

This is currently a solo portfolio project, built to solve a real reconciliation problem for a small business. See [`docs/04 - Engineering_Playbook.md`](docs/04%20-%20Engineering_Playbook.md) for conventions if you'd like to contribute.

## License

MIT