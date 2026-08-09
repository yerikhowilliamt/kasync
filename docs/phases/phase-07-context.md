# Phase 7 Context Handover: Authentication, Token Refresh & User Profile Management

## Key Decisions & Architecture Updates
- **User Model**: Added `User` table (`id`, `email`, `name`, `password_hash`, `refresh_token_hash`, `photo_url`, `created_at`, `updated_at`) via Prisma migrations `20260808170708_add_user_model` and `20260808174218_add_user_photo_url`.
- **Dual-Token System**:
  - Access Token: `1d` lifetime, set via `access_token` HttpOnly cookie & verified by `JwtAuthGuard`.
  - Refresh Token: `30d` lifetime, set via `refresh_token` HttpOnly cookie. Hash stored in DB `users.refresh_token_hash`.
- **Token Rotation & Revocation**: `POST /auth/refresh` verifies the refresh cookie against the DB bcrypt hash before issuing a new access token. `POST /auth/logout` sets `refreshTokenHash = null` in the database and clears HttpOnly cookies.
- **User Profile Management (`UsersModule`)**:
  - Get Profile (`GET /users/me`): Returns authenticated user profile (`id`, `email`, `name`, `photoUrl`).
  - Update Password (`PATCH /users/me/password`): Validates `oldPassword` with bcrypt, updates password hash.
  - Upload Profile Photo (`POST /users/me/photo`): Streams image buffer directly to Cloudinary via `CloudinaryService` and updates `photoUrl`.
  - Delete Account (`DELETE /users/me`): Deletes user record and clears authentication cookies.
- **Server Runtime Error Handling & Cloudinary QA Fixes**:
  - Handled Prisma P2003 foreign key constraint errors in `CategoriesService.remove` and `BranchesService.remove`, returning `400 Bad Request`.
  - Added safety error handling in `AuthService.logout` so deleting a user before logout completes without error.
  - Added global prefix exclusion for `metrics` and added `GET /metrics` in `HealthController` to serve Prometheus metrics at `GET /metrics`.
  - Updated Cloudinary image upload target folder to `kasync/profile-photos` and `kasync/general`.
  - Updated Postman Collection (`docs/kasync-api.postman_collection.json`) with collection variables and test scripts for dynamic ID linking.

## Progress & Verification Status
- Created `docs/plannings/07 - Authentication & Token Refresh.md`.
- Implemented `AuthModule`, `UsersModule`, `CloudinaryModule`, `UsersService`, `UsersController`, and DTOs.
- Configured `cookie-parser` middleware in `src/main.ts`.
- Updated system documentation: PRD, System Design, ADR-009, ADR-010, ERD, Engineering Playbook, Project Handbook, `.env.example`.
- Wrote unit tests for `AuthService`, `AuthController`, `UsersService`, `UsersController` (100% coverage).
- Added `test/auth.e2e-spec.ts` and `test/users.e2e-spec.ts`.
- Verification passed: `npx tsc --noEmit` (0 errors), `npm run lint` (0 errors), `npm run test` (110 passing unit tests), `npm run test:e2e` (14 passing e2e tests).
