# KAsync — Cash Flow Reconciliation & Allocation Tool

[![CI Pipeline](https://github.com/yerikhowilliamt/kasync/actions/workflows/ci.yml/badge.svg)](https://github.com/yerikhowilliamt/kasync/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)](https://nodejs.org)

KAsync is a NestJS + PostgreSQL + Prisma application designed for small multi-branch business owners to reconcile bank statements against manual internal cash records, manage multi-category split allocations, and maintain strict financial auditability.

---

## 📌 Problem & Core Concept

Small business owners routinely struggle with cash flow reconciliation due to three main root causes:
1. **Timing Gaps:** Settlement delays between manual logging and bank clearing.
2. **Aggregated Transactions:** Multiple small cash deposits corresponding to one manual record (or vice versa).
3. **Multi-purpose Transfers:** A single bank transaction funding multiple expense categories across multiple branches.

### The Allocation Model
`BankTransaction` and `LedgerEntry` are linked via an **`Allocation`** junction entity. 
- **1:1 Matches:** Direct single allocation matching total transaction amount.
- **1:Many Splits:** Single bank transaction split into multiple allocations across different categories/branches.
- **Many:1 Aggregations:** Multiple bank transactions allocated to a single ledger entry.
- **Database-Level Invariant:** The sum of active allocation portions for any bank transaction cannot exceed its total amount (`sum(amountPortion) <= bank_transaction.amount`).

---

## 🏗️ Technical Stack

- **Runtime & Language:** Node.js >= 20, TypeScript (`strict: true`)
- **Framework:** NestJS (modular monolith)
- **Database:** PostgreSQL 16
- **ORM:** Prisma ORM
- **Financial Math:** `decimal.js` / Prisma `Decimal` (Banker's Rounding `ROUND_HALF_EVEN`)
- **Logging:** `nestjs-pino` (GDPR-safe structured logging)
- **API Documentation:** `@nestjs/swagger` (Interactive UI at [/docs](http://localhost:3000/docs)) & Postman Collection (`docs/kasync-api.postman_collection.json`)
- **Testing:** Jest (Unit tests), Supertest (E2E & PostgreSQL Trigger tests)

---

## 🚀 Quick Start & Setup

### Prerequisites
- Node.js >= 20.x
- npm >= 10.x
- Docker & Docker Compose

### 1. Clone & Install
```bash
git clone https://github.com/yerikhowilliamt/kasync.git
cd kasync
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
```
Default `.env`:
```env
PORT=3000
NODE_ENV=development
DATABASE_URL="postgresql://postgres:postgrespassword@localhost:5432/kasync_db?schema=public"
```

### 3. Start PostgreSQL Container
```bash
docker compose up -d
```

### 4. Run Migrations & Apply Database Triggers
```bash
npx prisma migrate dev
```
*Note: Database triggers (`check_allocation_sum` with `FOR UPDATE` lock and `sync_transaction_status`) are embedded in the Prisma migration `20260809180000_multi_tenancy_and_triggers` and applied automatically.*

### 5. Seed Synthetic Demo Data
```bash
npm run seed
```

### 6. Start Application
```bash
npm run start:dev
```
Access Swagger API Docs: [http://localhost:3000/docs](http://localhost:3000/docs)

---

## 📖 API Documentation & Key Endpoints

Swagger UI is exposed at **`/docs`**. Key modules include:

| Module | Endpoint | Description |
|---|---|---|
| **Auth** | `POST /api/v1/auth/register`, `/login`, `/refresh`, `/logout` | Dual-token authentication & session management |
| **Users** | `PATCH /api/v1/users/me/password`, `POST /me/photo`, `DELETE /me` | Password updates, profile photo streaming, account deletion |
| **Import** | `POST /api/v1/import/csv` | Upload bank CSV statement (BCA, Mandiri) |
| **Accounts** | `GET /api/v1/accounts`, `POST /api/v1/accounts` | Manage bank, cash, and e-wallet accounts |
| **Ledger** | `GET /api/v1/ledger-entries`, `POST /api/v1/ledger-entries` | CRUD categorized internal business records |
| **Matching** | `POST /api/v1/matching/propose` | Run exact, fuzzy, & aggregate matching engine |
| | `POST /matching/reset` | Reset PENDING_REVIEW transactions back to UNRESOLVED | Protected |
| **Allocation** | `POST /api/v1/allocations`, `POST /api/v1/allocations/:id/revoke` | Create split allocations or revoke allocations |
| **Reconciliation** | `GET /api/v1/reconciliation/dashboard` | 4-way transaction status breakdown & balance variance |
| **Health** | `GET /api/v1/health` | System and database health status checks |

---

## 🔄 Reconciliation Flow Walkthrough

```
+-------------------+      +----------------------+      +----------------------+
|  1. Upload CSV    | ---> | 2. Propose Matches   | ---> | 3. Confirm / Split   |
|  (BCA / Mandiri)  |      | (Exact/Fuzzy/Agg)    |      | (Create Allocations) |
+-------------------+      +----------------------+      +----------------------+
                                                                    |
                                                                    v
                                                         +----------------------+
                                                         | 4. View Dashboard    |
                                                         | (Status & Variance)  |
                                                         +----------------------+
```

1. **Upload Bank Statement:** Client uploads statement CSV via `POST /import/csv?accountId={id}&bankType=BCA`.
2. **Propose Matches:** Run `POST /matching/propose` to evaluate exact, fuzzy ($\pm 3$ days window), and aggregate ($N \le 4$) candidates, moving transactions to `PENDING_REVIEW`.
3. **Split & Allocate:** Perform single or split allocations via `POST /allocations` linking bank transactions to ledger entries.
4. **Monitor Dashboard:** Query `GET /reconciliation/dashboard` to inspect actual bank balance, recorded ledger balance, variance, and status breakdown (`MATCHED`, `PARTIALLY_ALLOCATED`, `PENDING_REVIEW`, `UNRESOLVED`).

---

## 🔒 Database-Level Integrity & Triggers

To prevent race conditions and guarantee financial data integrity, two SQL triggers enforce rules directly in PostgreSQL (`docs/database/migration.sql`):

1. **`trg_check_allocation_sum` (`BEFORE INSERT OR UPDATE ON allocations`)**:
   - Acquires row lock via `SELECT amount FROM bank_transactions WHERE id = NEW.bank_transaction_id FOR UPDATE`.
   - Rejects write if `sum(active_allocations) + NEW.amount_portion > bank_transaction.amount`.
   - Intercepted globally by `PostgresTriggerExceptionFilter` returning HTTP 400 Bad Request.

2. **`trg_sync_transaction_status` (`AFTER INSERT OR UPDATE OR DELETE ON allocations`)**:
   - Auto-syncs `bank_transactions.status` between `UNRESOLVED`, `PARTIALLY_ALLOCATED`, and `MATCHED`.

*Note: Both triggers are embedded in the native Prisma migration and applied automatically via `npx prisma migrate dev`. No manual SQL step required.*

---

## 🧪 Testing & Verification

```bash
# Run unit tests (Matching engine, parsers, services)
npm run test

# Run integration & E2E tests (requires PostgreSQL container)
npm run test:e2e

# Run test coverage report
npm run test:cov

# Typecheck & Lint
npx tsc --noEmit && npm run lint
```

---

## 📂 Project Architecture

```
src/
├── modules/
│   ├── auth/            # Dual-token auth, register, login, refresh, logout
│   ├── users/           # Password update, profile photo (Cloudinary), account deletion
│   ├── import/          # Bank statement CSV parsers (BCA, Mandiri strategy pattern)
│   ├── accounts/        # Account management (Bank, Cash, E-Wallet)
│   ├── matching/        # Matching Engine (Pure TS, exact/fuzzy/aggregate logic)
│   ├── allocation/      # Split allocation engine & soft-revoke audit trail
│   ├── ledger-entries/  # Internal categorized business records
│   ├── categories/      # Expense/income categories
│   ├── branches/        # Cost centers / branches
│   ├── reconciliation/  # Read-side aggregate dashboard queries
│   └── health/          # System health check endpoint
├── common/
│   ├── filters/         # Exception filters (PostgresTriggerExceptionFilter)
│   ├── errors/          # Domain errors (AllocationExceededError)
│   ├── storage/         # StorageProvider DIP interface
│   ├── validators/      # Custom file & payload validators
│   ├── decorators/      # Custom decorators (@ReqUser, @Public)
│   └── prisma/          # Prisma Module & Service
docs/
├── 00 - PRD.md
├── 01 - System_Design.md
├── 02 - ADR.md
├── 03 - ERD.md
├── 04 - Engineering_Playbook.md
├── 05 - Project_Handbook.md
├── database/            # schema.prisma & migration.sql
└── phases/              # Phase execution contexts
```

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
