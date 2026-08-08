import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { PrismaClient } from '@prisma/client';
import { PostgresTriggerExceptionFilter } from '../src/common/filters/postgres-trigger-exception.filter';
import * as path from 'path';

interface ImportResponse {
  importedCount: number;
}

interface DashboardResponse {
  counts: {
    UNRESOLVED: number;
    PENDING_REVIEW: number;
    PARTIALLY_ALLOCATED: number;
    MATCHED: number;
  };
  actualBankBalance: string;
  recordedLedgerBalance: string;
  variance: string;
}

describe('Reconciliation User Journey (e2e)', () => {
  let app: INestApplication;
  const prisma = new PrismaClient();

  let accountId: string;
  let categoryId: string;
  let branchId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    app.useGlobalFilters(new PostgresTriggerExceptionFilter());
    await app.init();

    // 1. Setup account, category, branch
    const account = await prisma.account.create({
      data: {
        name: `E2E Journey Account ${Date.now()}`,
        type: 'BANK',
      },
    });
    accountId = account.id;

    const category = await prisma.category.create({
      data: { name: `E2E Category ${Date.now()}` },
    });
    categoryId = category.id;

    const branch = await prisma.branch.create({
      data: { name: `E2E Branch ${Date.now()}` },
    });
    branchId = branch.id;
  });

  afterAll(async () => {
    // Cleanup in reverse dependency order
    await prisma.allocation.deleteMany({
      where: {
        bankTransaction: { accountId },
      },
    });
    await prisma.bankTransaction.deleteMany({
      where: { accountId },
    });
    await prisma.ledgerEntry.deleteMany({
      where: {
        OR: [{ categoryId }, { branchId }],
      },
    });
    if (accountId) await prisma.account.delete({ where: { id: accountId } });
    if (categoryId) await prisma.category.delete({ where: { id: categoryId } });
    if (branchId) await prisma.branch.delete({ where: { id: branchId } });

    await prisma.$disconnect();
    await app.close();
  });

  it('Complete user journey: Import statement -> Propose match -> Confirm/allocate -> Split -> Dashboard verification', async () => {
    // Step 1: Import bank statement CSV (bca-valid.csv has 2 records)
    const csvPath = path.resolve(__dirname, 'fixtures/bca-valid.csv');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const importRes = await request(app.getHttpServer())
      .post('/import/csv')
      .field('accountId', accountId)
      .field('bankFormat', 'BCA')
      .attach('file', csvPath);

    expect(importRes.status).toBe(200);
    const importBody = importRes.body as ImportResponse;
    expect(importBody.importedCount).toBe(2);

    const importedTxns = await prisma.bankTransaction.findMany({
      where: { accountId },
      orderBy: { amount: 'desc' },
    });
    expect(importedTxns).toHaveLength(2);
    // bca-valid has 1500000 and 500000
    const tx150 = importedTxns[0];
    const tx50 = importedTxns[1];

    // Step 2: Create manual ledger entries matching total bank statement
    const le1 = await prisma.ledgerEntry.create({
      data: {
        categoryId,
        branchId,
        entryDate: tx150.txnDate,
        amount: 1000.0,
        type: 'INFLOW',
        note: 'Transfer Masuk 1000',
      },
    });

    const le2a = await prisma.ledgerEntry.create({
      data: {
        categoryId,
        branchId,
        entryDate: tx50.txnDate,
        amount: 300.0,
        type: 'OUTFLOW',
        note: 'Beli ATK 300',
      },
    });

    const le2b = await prisma.ledgerEntry.create({
      data: {
        categoryId,
        branchId,
        entryDate: tx50.txnDate,
        amount: 200.5,
        type: 'OUTFLOW',
        note: 'Beli Snack 200.5',
      },
    });

    // Step 3: Check initial dashboard state
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    let dashRes = await request(app.getHttpServer())
      .get(`/reconciliation/dashboard?accountId=${accountId}`)
      .expect(200);

    let dashBody = dashRes.body as DashboardResponse;
    expect(dashBody.counts.UNRESOLVED).toBe(2);
    expect(dashBody.counts.MATCHED).toBe(0);

    // Step 4: Run matching engine propose
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const proposeRes = await request(app.getHttpServer())
      .post('/matching/propose')
      .send({ accountId })
      .expect(200);

    expect(proposeRes.body).toBeDefined();

    // Verify 1000 txn set to PENDING_REVIEW
    const tx150Check = await prisma.bankTransaction.findUniqueOrThrow({
      where: { id: tx150.id },
    });
    expect(tx150Check.status).toBe('PENDING_REVIEW');

    // Step 5: Confirm match for tx150 (allocate full amount 1000)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    await request(app.getHttpServer())
      .post('/allocations')
      .send({
        bankTransactionId: tx150.id,
        ledgerEntryId: le1.id,
        amountPortion: 1000.0,
      })
      .expect(201);

    const tx150AfterAlloc = await prisma.bankTransaction.findUniqueOrThrow({
      where: { id: tx150.id },
    });
    expect(tx150AfterAlloc.status).toBe('MATCHED');

    // Step 6: Split allocation for tx50 (500.50 split into 300 + 200.50)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    await request(app.getHttpServer())
      .post('/allocations')
      .send({
        allocations: [
          {
            bankTransactionId: tx50.id,
            ledgerEntryId: le2a.id,
            amountPortion: 300.0,
          },
          {
            bankTransactionId: tx50.id,
            ledgerEntryId: le2b.id,
            amountPortion: 200.5,
          },
        ],
      })
      .expect(201);

    const tx50AfterAlloc = await prisma.bankTransaction.findUniqueOrThrow({
      where: { id: tx50.id },
    });
    expect(tx50AfterAlloc.status).toBe('MATCHED');

    // Step 7: Verify final dashboard metrics
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    dashRes = await request(app.getHttpServer())
      .get(`/reconciliation/dashboard?accountId=${accountId}`)
      .expect(200);

    dashBody = dashRes.body as DashboardResponse;
    expect(dashBody.counts.MATCHED).toBe(2);
    expect(dashBody.counts.UNRESOLVED).toBe(0);
    expect(dashBody.counts.PENDING_REVIEW).toBe(0);
    expect(dashBody.counts.PARTIALLY_ALLOCATED).toBe(0);

    // Bank txns in account: +1000.00 (INFLOW) - 500.50 (OUTFLOW) = 499.50
    expect(dashBody.actualBankBalance).toBe('499.50');
  });
});
