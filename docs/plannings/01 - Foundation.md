# Fase 1: Foundations

Context to attach: [System Design](./../01%20-%20System_Design.md), [Schema Prisma](./../database/schema.prisma), [Migration SQL](./../database/migration.sql), [Engineering Playbook](./../04%20-%20Engineering_Playbook.md)

You're setting up the foundation for a NestJS + PostgreSQL + Prisma project
called "Cash Flow Reconciliation & Allocation Tool." Follow the folder
structure and conventions in 04 - Engineering_Playbook.md
exactly — module-per-domain (import, matching, allocation, account,
reconciliation, common), no cross-module direct DB access.

Tasks:
1. Initialize the NestJS project with Prisma, class-validator, and Jest.
2. Create the folder structure per the playbook.
3. Set up docker-compose.yml for local PostgreSQL.
4. Add schema.prisma and place raw SQL trigger functions (check_allocation_sum with FOR UPDATE lock, sync_transaction_status) inside a native Prisma migration folder (prisma/migrations/).
5. Run `npx prisma migrate dev` to execute initial schema and raw SQL triggers simultaneously, verifying both triggers exist in local Postgres.
6. Implement `PostgresTriggerExceptionFilter` (`src/common/filters/postgres-trigger-exception.filter.ts`) to catch Prisma errors `P2010`/`P2034` thrown by database triggers and map them to HTTP 400 Bad Request/`AllocationExceededError`.
7. Set up a GitHub Actions workflow: install -> lint -> test.
8. Add .env.example and a setup section in README.md.

Definition of done: `npm run start:dev` boots against local Postgres, and
CI is green on the (currently empty) test suite. Don't implement any
domain logic yet — this phase is infrastructure only.
