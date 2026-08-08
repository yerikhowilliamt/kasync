import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { PrismaClient } from '@prisma/client';
import { PostgresTriggerExceptionFilter } from '../src/common/filters/postgres-trigger-exception.filter';

describe('Allocation Split (e2e)', () => {
  let app: INestApplication;
  const prisma = new PrismaClient();

  // Test data variables
  let accountId: string;
  let categoryId: string;
  let branchId: string;
  let bankTransactionId: string;
  let ledgerEntryId1: string;
  let ledgerEntryId2: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    app.useGlobalFilters(new PostgresTriggerExceptionFilter());
    await app.init();

    // Setup test data
    const account = await prisma.account.create({
      data: {
        name: 'Test Split Account',
        type: 'BANK',
      },
    });
    accountId = account.id;

    const category = await prisma.category.create({
      data: { name: `Test Split Category ${Date.now()}` },
    });
    categoryId = category.id;

    const branch = await prisma.branch.create({
      data: { name: `Test Split Branch ${Date.now()}` },
    });
    branchId = branch.id;
  });

  beforeEach(async () => {
    // Fresh transaction and ledger entries per test
    const tx = await prisma.bankTransaction.create({
      data: {
        accountId,
        txnDate: new Date(),
        amount: 1000.00,
        type: 'INFLOW',
        description: 'Split Test Txn',
        status: 'UNRESOLVED',
      },
    });
    bankTransactionId = tx.id;

    const le1 = await prisma.ledgerEntry.create({
      data: {
        categoryId,
        branchId,
        entryDate: new Date(),
        amount: 600.00,
        type: 'INFLOW',
        note: 'Split Entry 1',
      },
    });
    ledgerEntryId1 = le1.id;

    const le2 = await prisma.ledgerEntry.create({
      data: {
        categoryId,
        branchId,
        entryDate: new Date(),
        amount: 400.00,
        type: 'INFLOW',
        note: 'Split Entry 2',
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
    } catch (e) {
        // Ignore
    }

    await prisma.$disconnect();
    await app.close();
  });

  it('Test full API flow: Allocate split, retrieve, revoke, over-allocate', async () => {
    // 1. POST /allocations with split array
    const createRes = await request(app.getHttpServer())
      .post('/allocations')
      .send({
        allocations: [
          {
            bankTransactionId,
            ledgerEntryId: ledgerEntryId1,
            amountPortion: 600,
          },
          {
            bankTransactionId,
            ledgerEntryId: ledgerEntryId2,
            amountPortion: 400,
          },
        ],
      })
      .expect(201);

    expect(createRes.body).toHaveLength(2);
    const allocId1 = createRes.body[0].id;
    const allocId2 = createRes.body[1].id;

    // 2. Verify transaction status updated to MATCHED
    const tx = await prisma.bankTransaction.findUniqueOrThrow({ where: { id: bankTransactionId } });
    expect(tx.status).toBe('MATCHED');

    // 3. GET /allocations/transaction/:txnId
    const getTxnRes = await request(app.getHttpServer())
      .get(`/allocations/transaction/${bankTransactionId}`)
      .expect(200);

    expect(getTxnRes.body).toHaveLength(2);
    expect(getTxnRes.body[0]).toHaveProperty('ledgerEntry');

    // 4. GET /allocations/ledger-entry/:ledgerEntryId
    const getLeRes = await request(app.getHttpServer())
      .get(`/allocations/ledger-entry/${ledgerEntryId1}`)
      .expect(200);

    expect(getLeRes.body).toHaveLength(1);
    expect(getLeRes.body[0]).toHaveProperty('bankTransaction');

    // 5. POST /allocations/:id/revoke -> transaction status reverts
    await request(app.getHttpServer())
      .post(`/allocations/${allocId1}/revoke`)
      .expect(201); // Assuming 201 for POST action.

    const txReverted = await prisma.bankTransaction.findUniqueOrThrow({ where: { id: bankTransactionId } });
    expect(txReverted.status).toBe('PARTIALLY_ALLOCATED');
    
    // Verify allocation status
    const revokedAlloc = await prisma.allocation.findUniqueOrThrow({ where: { id: allocId1 } });
    expect(revokedAlloc.status).toBe('REVOKED');

    // 6. POST /allocations with over-allocation (500 when max remaining is 400)
    await request(app.getHttpServer())
      .post('/allocations')
      .send({
        allocations: [
          {
            bankTransactionId,
            ledgerEntryId: ledgerEntryId1,
            amountPortion: 700, // Now 700 + 400(active) = 1100 > 1000
          },
        ]
      })
      .expect(400); // Bad Request (AllocationExceededError/Trigger)
  });
});
