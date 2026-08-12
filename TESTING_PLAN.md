# QA Test Plan

This document outlines the risk-based testing strategy for the Kasync application.

## Phase 1: Authentication & Authorization

### Critical Risk

| Test Case ID | Description | Expected Result |
|---|---|---|
| AUTH-C-01 | Attempt to access a protected endpoint (e.g., `GET /api/v1/users/me`) without any authentication credentials. | Request is rejected with a 401 Unauthorized status. |
| AUTH-C-02 | Attempt to access a protected endpoint with an expired Access Token. | Request is rejected with a 401 Unauthorized status. |
| AUTH-C-03 | Attempt to access a protected endpoint with a valid Refresh Token instead of an Access Token. | Request is rejected with a 401 Unauthorized status. |
| AUTH-C-04 | Forge a JWT with a different user's ID but a valid signature from another user's token. Attempt to access the original user's resources. | Request is rejected. The server must validate that the user ID in the token matches the signature. |
| AUTH-C-05 | After a user logs out (`POST /api/v1/auth/logout`), immediately try to use their just-invalidated Access Token and Refresh Token. | All subsequent requests with the old tokens fail with a 401 Unauthorized status. |

### High Risk

| Test Case ID | Description | Expected Result |
|---|---|---|
| AUTH-H-01 | Register a new user (`POST /api/v1/auth/register`) and immediately try to log in (`POST /api/v1/auth/login`). | Login is successful, and valid Access/Refresh tokens are issued. |
| AUTH-H-02 | Let an Access Token expire, then use the Refresh Token to get a new one (`POST /api/v1/auth/refresh`). | A new, valid Access Token is issued, and the original Refresh Token remains valid. |
| AUTH-H-03 | Attempt to update a user's password (`PATCH /api/v1/users/me/password`) with an incorrect `oldPassword`. | Request is rejected with a 400 or 401 error. The password is not changed. |
| AUTH-H-04 | Attempt to register with a password that does not meet the complexity requirements (e.g., "password"). | Request is rejected with a 400 Bad Request and a clear error message. |
| AUTH-H-05 | Attempt to update to a new password that does not meet the complexity requirements. | Request is rejected with a 400 Bad Request. |

## Phase 2: Data Integrity & Concurrency (Allocations)

### Critical Risk

| Test Case ID | Description | Expected Result |
|---|---|---|
| DATA-C-01 | Concurrently send two separate requests to allocate the full amount of the same bank transaction. (e.g., Bank Txn Amount: $100. Request 1: Allocate $100. Request 2: Allocate $100). | One request succeeds (201 Created). The other fails with a 400 Bad Request due to the `check_allocation_sum` trigger. The final allocated sum is exactly $100. |
| DATA-C-02 | Concurrently send two separate requests to allocate partial amounts of the same transaction, where the sum exceeds the total. (e.g., Bank Txn Amount: $100. Request 1: Allocate $70. Request 2: Allocate $70). | One request succeeds. The other fails with a 400 Bad Request. The final allocated sum is exactly $70. |
| DATA-C-03 | Create an allocation for more than the total amount of a bank transaction in a single request. (e.g., Bank Txn Amount: $100. Request: Allocate $101). | Request is rejected with a 400 Bad Request. No allocation is created. |
| DATA-C-04 | Create a split allocation where the sum of the portions exceeds the bank transaction amount. | The entire transaction is rolled back. No allocation records are created. Request fails with a 400 error. |

### High Risk

| Test Case ID | Description | Expected Result |
|---|---|---|
| DATA-H-01 | Create a valid split allocation where portions sum exactly to the transaction amount. | Allocations are created successfully. The `bank_transaction.status` is updated to `MATCHED`. |
| DATA-H-02 | Create a partial allocation (less than the total amount). | Allocation is created. The `bank_transaction.status` is updated to `PARTIALLY_ALLOCATED`. |
| DATA-H-03 | Revoke an allocation (`POST /api/v1/allocations/:id/revoke`). | The allocation is marked as inactive/revoked. The `bank_transaction.status` is correctly recalculated (e.g., from `MATCHED` to `PARTIALLY_ALLOCATED`). |
| DATA-H-04 | Attempt to allocate to a non-existent bank transaction or ledger entry. | Request fails with a 404 or 400 error. |
| DATA-H-05 | Attempt to create an allocation between an INFLOW bank transaction and an OUTFLOW ledger entry. | Request is rejected with a 400 Bad Request, as per ADR-019. |

This is the initial set of high-priority test cases. I will now continue with the remaining phases.
