import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
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

describe('Complete Reconciliation Flow (e2e)', () => {
  let app: INestApplication;
  const prisma = new PrismaClient();

  let accountId: string;
  let categoryId: string;
  let branchId: string;
  let authCookie: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    app.useGlobalFilters(new PostgresTriggerExceptionFilter());
    await app.init();

    // 1. Setup account, category, branch
    const account = await prisma.account.create({
      data: {
        name: `Complete Flow Account ${Date.now()}`,
        type: 'BANK',
      },
    });
    accountId = account.id;

    const category = await prisma.category.create({
      data: { name: `Complete Category ${Date.now()}` },
    });
    categoryId = category.id;

    const branch = await prisma.branch.create({
      data: { name: `Complete Branch ${Date.now()}` },
    });
    branchId = branch.id;

    // Register user for test authentication
    const regRes = await request(
      app.getHttpServer() as unknown as Parameters<typeof request>[0],
    )
      .post('/auth/register')
      .send({
        email: `complete-flow-user-${Date.now()}@example.com`,
        password: 'password123',
        name: 'Complete Flow User',
      });
    const cookies = regRes.headers['set-cookie'] as unknown as string[];
    authCookie = cookies.find((c) => c.startsWith('access_token='))!;
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

  it('Executes complete lifecycle: Register Auth -> Create Ledger Entries -> Upload Mandiri CSV -> Propose Match -> Single & Split Allocation -> Dashboard Verification', async () => {
    const server = app.getHttpServer() as unknown as Parameters<
      typeof request
    >[0];

    // Step 1: Create manual ledger entries via REST endpoint POST /ledger-entries
    // mandiri-valid.csv has:
    // 1. INFLOW 1000.00
    // 2. OUTFLOW 500.00 (Split into 300.00 + 200.00)

    const leInflowRes = await request(server)
      .post('/ledger-entries')
      .set('Cookie', [authCookie])
      .send({
        categoryId,
        branchId,
        entryDate: '2024-01-15T00:00:00.000Z',
        amount: 1000.0,
        type: 'INFLOW',
        note: 'Complete Inflow Entry 1000',
      })
      .expect(201);
    const leInflowId = (leInflowRes.body as { id: string }).id;

    const leOutflow1Res = await request(server)
      .post('/ledger-entries')
      .set('Cookie', [authCookie])
      .send({
        categoryId,
        branchId,
        entryDate: '2024-01-16T00:00:00.000Z',
        amount: 300.0,
        type: 'OUTFLOW',
        note: 'Complete Outflow Split 1',
      })
      .expect(201);
    const leOutflow1Id = (leOutflow1Res.body as { id: string }).id;

    const leOutflow2Res = await request(server)
      .post('/ledger-entries')
      .set('Cookie', [authCookie])
      .send({
        categoryId,
        branchId,
        entryDate: '2024-01-16T00:00:00.000Z',
        amount: 200.0,
        type: 'OUTFLOW',
        note: 'Complete Outflow Split 2',
      })
      .expect(201);
    const leOutflow2Id = (leOutflow2Res.body as { id: string }).id;

    // Step 2: Upload Mandiri CSV Statement via POST /import/csv
    const csvPath = path.resolve(__dirname, 'fixtures/mandiri-valid.csv');

    const importRes = await request(server)
      .post('/import/csv')
      .set('Cookie', [authCookie])
      .field('accountId', accountId)
      .field('bankFormat', 'MANDIRI')
      .attach('file', csvPath)
      .expect(200);

    const importBody = importRes.body as ImportResponse;
    expect(importBody.importedCount).toBe(2);

    const txns = await prisma.bankTransaction.findMany({
      where: { accountId },
      orderBy: { amount: 'desc' },
    });
    expect(txns).toHaveLength(2);
    const txInflow = txns[0]; // 1000.00
    const txOutflow = txns[1]; // 500.00

    // Step 3: Check initial dashboard state (2 UNRESOLVED)
    // Note: accountId scopes bank transactions correctly; ledger balance
    // is global per category/branch so we only assert counts and bank balance
    let dashRes = await request(server)
      .get(`/reconciliation/dashboard?accountId=${accountId}`)
      .set('Cookie', [authCookie])
      .expect(200);

    let dashBody = dashRes.body as DashboardResponse;
    expect(dashBody.counts.UNRESOLVED).toBe(2);
    expect(dashBody.counts.MATCHED).toBe(0);

    // Step 4: Run Matching Engine Propose via POST /matching/propose
    await request(server)
      .post('/matching/propose')
      .set('Cookie', [authCookie])
      .send({ accountId })
      .expect(200);

    const txInflowCheck = await prisma.bankTransaction.findUniqueOrThrow({
      where: { id: txInflow.id },
    });
    expect(txInflowCheck.status).toBe('PENDING_REVIEW');

    // Step 5: Allocate Single Match for txInflow (1000.00)
    await request(server)
      .post('/allocations')
      .set('Cookie', [authCookie])
      .send({
        bankTransactionId: txInflow.id,
        ledgerEntryId: leInflowId,
        amountPortion: 1000.0,
      })
      .expect(201);

    const txInflowAfterAlloc = await prisma.bankTransaction.findUniqueOrThrow({
      where: { id: txInflow.id },
    });
    expect(txInflowAfterAlloc.status).toBe('MATCHED');

    // Step 6: Allocate Split Match for txOutflow (500.00 -> 300.00 + 200.00)
    await request(server)
      .post('/allocations')
      .set('Cookie', [authCookie])
      .send({
        allocations: [
          {
            bankTransactionId: txOutflow.id,
            ledgerEntryId: leOutflow1Id,
            amountPortion: 300.0,
          },
          {
            bankTransactionId: txOutflow.id,
            ledgerEntryId: leOutflow2Id,
            amountPortion: 200.0,
          },
        ],
      })
      .expect(201);

    const txOutflowAfterAlloc = await prisma.bankTransaction.findUniqueOrThrow({
      where: { id: txOutflow.id },
    });
    expect(txOutflowAfterAlloc.status).toBe('MATCHED');

    // Step 7: Verify final dashboard metrics
    dashRes = await request(server)
      .get(`/reconciliation/dashboard?accountId=${accountId}`)
      .set('Cookie', [authCookie])
      .expect(200);

    dashBody = dashRes.body as DashboardResponse;
    expect(dashBody.counts.MATCHED).toBe(2);
    expect(dashBody.counts.UNRESOLVED).toBe(0);
    expect(dashBody.counts.PENDING_REVIEW).toBe(0);
    expect(dashBody.counts.PARTIALLY_ALLOCATED).toBe(0);

    // Bank actual balance: +1000.00 (INFLOW) - 500.00 (OUTFLOW) = 500.00
    // Note: recordedLedgerBalance is global per category/branch (not scoped by accountId),
    // so we only assert actualBankBalance which is properly scoped
    expect(dashBody.actualBankBalance).toBe('500.00');
  });
});
