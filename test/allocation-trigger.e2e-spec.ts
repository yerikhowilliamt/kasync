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

  beforeAll(async () => {
    // Setup test data
    const account = await prisma.account.create({
      data: {
        name: 'Test Trigger Account',
        type: 'BANK',
      },
    });
    accountId = account.id;

    const category = await prisma.category.create({
      data: { name: `Test Trigger Category ${Date.now()}` },
    });
    categoryId = category.id;

    const branch = await prisma.branch.create({
      data: { name: `Test Trigger Branch ${Date.now()}` },
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

    const le1 = await prisma.ledgerEntry.create({
      data: {
        categoryId,
        branchId,
        entryDate: new Date(),
        amount: 600.0,
        type: 'INFLOW',
        note: 'Entry 1',
      },
    });
    ledgerEntryId1 = le1.id;

    const le2 = await prisma.ledgerEntry.create({
      data: {
        categoryId,
        branchId,
        entryDate: new Date(),
        amount: 600.0,
        type: 'INFLOW',
        note: 'Entry 2',
      },
    });
    ledgerEntryId2 = le2.id;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.allocation.deleteMany({
      where: { bankTransactionId },
    });
    await prisma.ledgerEntry.deleteMany({
      where: { id: { in: [ledgerEntryId1, ledgerEntryId2] } },
    });
    await prisma.bankTransaction.deleteMany({
      where: { id: bankTransactionId },
    });

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
});
