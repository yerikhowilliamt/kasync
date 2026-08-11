import { PrismaClient } from '@prisma/client';

describe('Allocation Triggers (e2e)', () => {
  const prisma = new PrismaClient();

  // Test data variables
  let accountId: string;
  let categoryId: string;
  let branchId: string;
  let bankTransactionId: string;
  let ledgerEntryId1: string;
  let ledgerEntryId2: string;
  let userId: string;

  // Track all created IDs across beforeEach calls for reliable cleanup
  const createdTxnIds: string[] = [];
  const createdLeIds: string[] = [];

  beforeAll(async () => {
    // create user
    const user = await prisma.user.create({
      data: {
        name: 'Test Trigger User',
        email: `trigger-user-${Date.now()}@example.com`,
        passwordHash: 'test',
      },
    });
    userId = user.id;

    // Setup test data
    const account = await prisma.account.create({
      data: {
        name: 'Test Trigger Account',
        type: 'BANK',
        user: { connect: { id: userId } },
      },
    });
    accountId = account.id;

    const category = await prisma.category.create({
      data: {
        name: `Test Trigger Category ${Date.now()}`,
        user: { connect: { id: userId } },
      },
    });
    categoryId = category.id;

    const branch = await prisma.branch.create({
      data: {
        name: `Test Trigger Branch ${Date.now()}`,
        user: { connect: { id: userId } },
      },
    });
    branchId = branch.id;
  });

  beforeEach(async () => {
    // Fresh transaction and ledger entries per test
    const tx = await prisma.bankTransaction.create({
      data: {
        accountId,
        txnDate: new Date(),
        amount: 1000.0,
        type: 'INFLOW',
        description: 'Trigger Test Txn',
        status: 'UNRESOLVED',
      },
    });
    bankTransactionId = tx.id;
    createdTxnIds.push(tx.id);

    const le1 = await prisma.ledgerEntry.create({
      data: {
        category: { connect: { id: categoryId } },
        branch: { connect: { id: branchId } },
        entryDate: new Date(),
        amount: 600.0,
        type: 'INFLOW',
        note: 'Entry 1',
        user: { connect: { id: userId } },
      },
    });
    ledgerEntryId1 = le1.id;
    createdLeIds.push(le1.id);

    const le2 = await prisma.ledgerEntry.create({
      data: {
        category: { connect: { id: categoryId } },
        branch: { connect: { id: branchId } },
        entryDate: new Date(),
        amount: 600.0,
        type: 'INFLOW',
        note: 'Entry 2',
        user: { connect: { id: userId } },
      },
    });
    ledgerEntryId2 = le2.id;
    createdLeIds.push(le2.id);
  });

  afterAll(async () => {
    // Cleanup all created test data (not just last beforeEach's IDs)
    if (createdTxnIds.length > 0) {
      await prisma.allocation.deleteMany({
        where: { bankTransactionId: { in: createdTxnIds } },
      });
      await prisma.bankTransaction.deleteMany({
        where: { id: { in: createdTxnIds } },
      });
    }
    if (createdLeIds.length > 0) {
      await prisma.ledgerEntry.deleteMany({
        where: { id: { in: createdLeIds } },
      });
    }

    // Attempt cleanup of shared setup
    try {
      await prisma.account.delete({ where: { id: accountId } });
      await prisma.category.delete({ where: { id: categoryId } });
      await prisma.branch.delete({ where: { id: branchId } });
    } catch {
      // Ignore errors if other tests are using these
    }
    await prisma.$disconnect();
  });

  it('Test 1: Concurrency / Row Locking (FOR UPDATE trigger)', async () => {
    // Execute 2 concurrent allocation creates (600 + 600 = 1200 > 1000)
    const results = await Promise.allSettled([
      prisma.$executeRawUnsafe(`
        INSERT INTO allocations (id, bank_transaction_id, ledger_entry_id, amount_portion, status, created_at)
        VALUES (gen_random_uuid(), '${bankTransactionId}', '${ledgerEntryId1}', 600.00, 'ACTIVE', NOW())
      `),
      prisma.$executeRawUnsafe(`
        INSERT INTO allocations (id, bank_transaction_id, ledger_entry_id, amount_portion, status, created_at)
        VALUES (gen_random_uuid(), '${bankTransactionId}', '${ledgerEntryId2}', 600.00, 'ACTIVE', NOW())
      `),
    ]);

    // One should succeed, one should fail
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    // Verify DB state
    const sum = await prisma.allocation.aggregate({
      _sum: { amountPortion: true },
      where: { bankTransactionId, status: 'ACTIVE' },
    });

    expect(Number(sum._sum.amountPortion)).toBe(600);
  });

  it('Test 2: sync_transaction_status trigger across all 4 statuses', async () => {
    // Transaction starts at UNRESOLVED
    let tx = await prisma.bankTransaction.findUniqueOrThrow({
      where: { id: bankTransactionId },
    });
    expect(tx.status).toBe('UNRESOLVED');

    // Set proposed status PENDING_REVIEW
    await prisma.bankTransaction.update({
      where: { id: bankTransactionId },
      data: { status: 'PENDING_REVIEW' },
    });
    tx = await prisma.bankTransaction.findUniqueOrThrow({
      where: { id: bankTransactionId },
    });
    expect(tx.status).toBe('PENDING_REVIEW');

    // Insert active allocation of 400.00 -> PARTIALLY_ALLOCATED
    const alloc1 = await prisma.allocation.create({
      data: {
        bankTransactionId,
        ledgerEntryId: ledgerEntryId1,
        amountPortion: 400.0,
        status: 'ACTIVE',
      },
    });

    tx = await prisma.bankTransaction.findUniqueOrThrow({
      where: { id: bankTransactionId },
    });
    expect(tx.status).toBe('PARTIALLY_ALLOCATED');

    // Insert active allocation of 600.00 -> MATCHED
    const alloc2 = await prisma.allocation.create({
      data: {
        bankTransactionId,
        ledgerEntryId: ledgerEntryId2,
        amountPortion: 600.0,
        status: 'ACTIVE',
      },
    });

    tx = await prisma.bankTransaction.findUniqueOrThrow({
      where: { id: bankTransactionId },
    });
    expect(tx.status).toBe('MATCHED');

    // Soft-revoke one allocation -> PARTIALLY_ALLOCATED
    await prisma.allocation.update({
      where: { id: alloc1.id },
      data: { status: 'REVOKED', revokedAt: new Date() },
    });

    tx = await prisma.bankTransaction.findUniqueOrThrow({
      where: { id: bankTransactionId },
    });
    expect(tx.status).toBe('PARTIALLY_ALLOCATED');

    // Hard delete remaining allocation -> UNRESOLVED
    await prisma.allocation.delete({
      where: { id: alloc2.id },
    });

    tx = await prisma.bankTransaction.findUniqueOrThrow({
      where: { id: bankTransactionId },
    });
    expect(tx.status).toBe('UNRESOLVED');
  });

  it('Test 3: Boundary value - exact remaining amount should succeed', async () => {
    // Transaction amount is 1000.00
    // Create an allocation of 999.99
    await prisma.allocation.create({
      data: {
        bankTransactionId,
        ledgerEntryId: ledgerEntryId1,
        amountPortion: 999.99,
        status: 'ACTIVE',
      },
    });

    // Verify transaction status is PARTIALLY_ALLOCATED
    let tx = await prisma.bankTransaction.findUniqueOrThrow({
      where: { id: bankTransactionId },
    });
    expect(tx.status).toBe('PARTIALLY_ALLOCATED');

    // Attempt to allocate the exact remaining amount: 0.01
    // This should SUCCEED because 999.99 + 0.01 == 1000.00 (not > 1000.00)
    await prisma.allocation.create({
      data: {
        bankTransactionId,
        ledgerEntryId: ledgerEntryId2,
        amountPortion: 0.01,
        status: 'ACTIVE',
      },
    });

    tx = await prisma.bankTransaction.findUniqueOrThrow({
      where: { id: bankTransactionId },
    });
    expect(tx.status).toBe('MATCHED');

    // Verify sum is exactly 1000
    const sum = await prisma.allocation.aggregate({
      _sum: { amountPortion: true },
      where: { bankTransactionId, status: 'ACTIVE' },
    });
    expect(Number(sum._sum.amountPortion)).toBe(1000);
  });

  it('Test 4: Concurrent allocation UPDATEs should be serialized', async () => {
    // Create an initial allocation of 800
    const initialAlloc = await prisma.allocation.create({
      data: {
        bankTransactionId,
        ledgerEntryId: ledgerEntryId1,
        amountPortion: 800,
        status: 'ACTIVE',
      },
    });

    // Transaction has 200 remaining. Attempt two concurrent updates:
    // 1. User tries to add 200 to existing allocation (800+200=1000) - should succeed
    // 2. User tries to add 200 to a new allocation (800+200=1000, then +200=1200 > 1000) - should fail

    // Update the first allocation to the max (800 -> 1000)
    const update1 = prisma.allocation.update({
      where: { id: initialAlloc.id },
      data: { amountPortion: 1000 },
    });

    // Try to create a second allocation for 300 (which would total 1300 > 1000)
    const update2 = prisma.allocation.create({
      data: {
        bankTransactionId,
        ledgerEntryId: ledgerEntryId2,
        amountPortion: 300,
        status: 'ACTIVE',
      },
    });

    const results = await Promise.allSettled([update1, update2]);

    // One should succeed (the update), one should fail (the new allocation)
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    // Final state: only the first allocation exists with amount 1000
    const allocations = await prisma.allocation.findMany({
      where: { bankTransactionId, status: 'ACTIVE' },
    });
    expect(allocations).toHaveLength(1);
    expect(Number(allocations[0].amountPortion)).toBe(1000);
  });
});
