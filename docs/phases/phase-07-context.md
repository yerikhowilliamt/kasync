# Phase 7 Context Handover: Authentication & Token Refresh

## Key Decisions & Architecture Updates
- **User Model**: Added `User` table (`id`, `email`, `name`, `password_hash`, `refresh_token_hash`, `created_at`, `updated_at`) via Prisma migration `20260808170708_add_user_model`.
- **Dual-Token System**:
  - Access Token: `1d` lifetime, set via `access_token` HttpOnly cookie & verified by `JwtAuthGuard`.
  - Refresh Token: `30d` lifetime, set via `refresh_token` HttpOnly cookie. Hash stored in DB `users.refresh_token_hash`.
- **Token Rotation & Revocation**: `POST /auth/refresh` verifies the refresh cookie against the DB bcrypt hash before issuing a new access token. `POST /auth/logout` sets `refreshTokenHash = null` in the database and clears HttpOnly cookies.
- **Global Protection**: Replaced static `ApiKeyGuard` with `JwtAuthGuard` in `AppModule`. Unprotected routes (`/auth/register`, `/auth/login`, `/auth/refresh`, `/health`, `/docs`) use `@Public()` decorator.

## Progress & Verification Status
- Created `docs/plannings/07 - Authentication & Token Refresh.md`.
- Implemented `AuthModule`, `AuthService`, `AuthController`, `RegisterDto`, `LoginDto`, and `JwtAuthGuard`.
- Configured `cookie-parser` middleware in `src/main.ts`.
- Updated system documentation: PRD, System Design, ADR-009, ERD, Project Handbook, `.env.example`.
- Wrote unit tests for `AuthService` and `AuthController` (100% coverage).
- Added `test/auth.e2e-spec.ts` and updated E2E suites (`allocation-split.e2e-spec.ts`, `reconciliation.e2e-spec.ts`) with cookie authentication.
- Verification passed: `npx tsc --noEmit` (0 errors), `npm run lint` (0 errors), `npm run test` (100 passing tests), `npm run test:e2e` (10 passing tests).
