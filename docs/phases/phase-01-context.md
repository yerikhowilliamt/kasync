# Phase 1 Context — Foundation

**Status:** Complete
**Date:** 2026-08-08
**Branch:** `feat/foundation`

## What Was Done
- NestJS 11 project initialized with Prisma 5, class-validator, Jest, nestjs-pino, decimal.js, @nestjs/swagger
- Module-per-domain folder structure: import, matching, allocation, accounts, reconciliation + common
- docker-compose.yml with PostgreSQL 16 on port 5432 (kasync_db)
- Prisma schema with full data model in `prisma/schema.prisma`
- Single migration containing DDL + two trigger functions (`check_allocation_sum` with FOR UPDATE lock, `sync_transaction_status`)
- `PostgresTriggerExceptionFilter` catches P2010/P2034 → maps to `AllocationExceededError` (HTTP 400)
- Global `PrismaModule` + `PrismaService` (OnModuleInit/OnModuleDestroy lifecycle)
- GitHub Actions CI: install → typecheck → lint → unit test → e2e test (with Postgres service container)
- README with setup instructions, .env.example

## Key Decisions
- Prisma 5.x (not 7.x) — 7.x removed `url` from schema.prisma, breaking traditional workflow. 5.x keeps url in schema, simpler local dev.
- Global PrismaModule — avoids boilerplate in every domain module. Playbook allows this as it's infrastructure, not domain access.
- Triggers in same migration as DDL — ensures schema and triggers are always in sync per ADR-003 and Definition of Done.
- Exception filter registered in main.ts — catches all Prisma trigger errors globally.

## State
- `docker compose up -d` running on port 5432
- DB migrated, triggers verified via `pg_isready` and `\df`
- All modules registered but empty (no domain logic yet)
- Swagger at `/docs`

## Review (2026-08-08)
- **Score:** 9/10
- **Production Ready:** Almost
- **Must Fix Before Phase 2:** Add `--runInBand` to `test:e2e` script
- **Improve Later:** Helmet, CORS, regex extract PG error detail in filter

## For Next Phase
- Ready for Phase 2 (Accounts & Import)
- Empty module stubs need controllers/services
- PrismaService available globally via DI
- Exception filter handles allocation constraint violations automatically
