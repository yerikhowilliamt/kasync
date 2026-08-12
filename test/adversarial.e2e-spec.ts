import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { AllocationStatus, TransactionStatus } from '@prisma/client';

describe('Adversarial E2E - Financial Integrity & Security', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
    prisma = app.get(PrismaService);
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  beforeEach(async () => {
    await prisma.allocation.deleteMany({});
    await prisma.bankTransaction.deleteMany({});
    await prisma.ledgerEntry.deleteMany({});
    await prisma.account.deleteMany({});
    await prisma.category.deleteMany({});
    await prisma.branch.deleteMany({});
    await prisma.user.deleteMany({});
  });

  afterAll(async () => {
    await app.close();
  });

  const extractAccessToken = (cookies: string[]): string => {
    const cookie = cookies
      .find((c) => c.startsWith('access_token='))
      ?.split(';')[0];
    if (!cookie) throw new Error('Access token cookie not found');
    return cookie;
  };

  async function createUserAndGetAuth(email: string, name: string) {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, name, password: 'StrongPass1!' })
      .expect(201);
    const cookies = res.headers['set-cookie'] as string[];
    const accessToken = extractAccessToken(cookies);
    return { userId: res.body.id, accessToken };
  }

  async function createAccount(
    accessToken: string,
    name: string,
    type: 'BANK' | 'CASH' | 'EWALLET',
  ) {
    const res = await request(app.getHttpServer())
      .post('/api/v1/accounts')
      .set('Cookie', [accessToken])
      .send({ name, type })
      .expect(201);
    return res.body.id;
  }

  async function createCategory(accessToken: string, name: string) {
    const res = await request(app.getHttpServer())
      .post('/api/v1/categories')
      .set('Cookie', [accessToken])
      .send({ name })
      .expect(201);
    return res.body.id;
  }

  async function createBranch(accessToken: string, name: string) {
    const res = await request(app.getHttpServer())
      .post('/api/v1/branches')
      .set('Cookie', [accessToken])
      .send({ name })
      .expect(201);
    return res.body.id;
  }

  async function createBankTransaction(
    accountId: string,
    amount: number,
    type: 'INFLOW' | 'OUTFLOW',
  ) {
    const txn = await prisma.bankTransaction.create({
      data: {
        accountId,
        txnDate: new Date(),
        amount: amount.toString(),
        type,
        description: 'Test transaction',
        status: TransactionStatus.UNRESOLVED,
      },
    });
    return txn;
  }

  async function createLedgerEntry(
    userId: string,
    categoryId: string,
    branchId: string,
    amount: number,
    type: 'INFLOW' | 'OUTFLOW',
  ) {
    const entry = await prisma.ledgerEntry.create({
      data: {
        userId,
        categoryId,
        branchId,
        entryDate: new Date(),
        amount: amount.toString(),
        type,
      },
    });
    return entry;
  }

  it('Multi-tenancy: User B cannot allocate User A s transaction to User A s ledger entry (IDOR)', async () => {
    const { userId: userIdA, accessToken: tokenA } = await createUserAndGetAuth(
      'aa@example.com',
      'UserA',
    );
    const accountAId = await createAccount(tokenA, 'AcctA', 'BANK');
    const catAId = await createCategory(tokenA, 'CatA');
    const brAId = await createBranch(tokenA, 'BrA');
    const txnA = await createBankTransaction(accountAId, 1000, 'INFLOW');
    const ledgerA = await createLedgerEntry(
      userIdA,
      catAId,
      brAId,
      1000,
      'INFLOW',
    );

    const { accessToken: tokenB } = await createUserAndGetAuth(
      'bb@example.com',
      'UserB',
    );

    await request(app.getHttpServer())
      .post('/api/v1/allocations')
      .set('Cookie', [tokenB])
      .send({
        bankTransactionId: txnA.id,
        ledgerEntryId: ledgerA.id,
        amountPortion: 1000,
      })
      .expect(404);

    const allocations = await prisma.allocation.findMany({
      where: { ledgerEntryId: ledgerA.id },
    });
    expect(allocations).toHaveLength(0);
  });

  it('Business Logic: Allocation type mismatch (INFLOW to OUTFLOW) is rejected', async () => {
    const { userId, accessToken } = await createUserAndGetAuth(
      'type@example.com',
      'TypeTest',
    );
    const accountId = await createAccount(accessToken, 'Main', 'BANK');
    const categoryId = await createCategory(accessToken, 'Expenses');
    const branchId = await createBranch(accessToken, 'HQ');

    const inflowTxn = await createBankTransaction(accountId, 500, 'INFLOW');
    const outflowLedger = await createLedgerEntry(
      userId,
      categoryId,
      branchId,
      500,
      'OUTFLOW',
    );

    await request(app.getHttpServer())
      .post('/api/v1/allocations')
      .set('Cookie', [accessToken])
      .send({
        bankTransactionId: inflowTxn.id,
        ledgerEntryId: outflowLedger.id,
        amountPortion: 500,
      })
      .expect(400);

    const allocations = await prisma.allocation.findMany({
      where: { bankTransactionId: inflowTxn.id },
    });
    expect(allocations).toHaveLength(0);
  });

  it('State Management: Revoked allocation cannot be revoked again', async () => {
    const { userId, accessToken } = await createUserAndGetAuth(
      'revoke@example.com',
      'RevokeTest',
    );
    const accountId = await createAccount(accessToken, 'Main', 'BANK');
    const categoryId = await createCategory(accessToken, 'Income');
    const branchId = await createBranch(accessToken, 'Branch1');

    const txn = await createBankTransaction(accountId, 200, 'INFLOW');
    const ledger = await createLedgerEntry(
      userId,
      categoryId,
      branchId,
      200,
      'INFLOW',
    );

    const createRes = await request(app.getHttpServer())
      .post('/api/v1/allocations')
      .set('Cookie', [accessToken])
      .send({
        bankTransactionId: txn.id,
        ledgerEntryId: ledger.id,
        amountPortion: 200,
      })
      .expect(201);
    const allocationId = createRes.body[0].id;

    await request(app.getHttpServer())
      .post(`/api/v1/allocations/${allocationId}/revoke`)
      .set('Cookie', [accessToken])
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/v1/allocations/${allocationId}/revoke`)
      .set('Cookie', [accessToken])
      .expect(400);

    const allocation = await prisma.allocation.findUnique({
      where: { id: allocationId },
    });
    expect(allocation?.status).toBe(AllocationStatus.REVOKED);
  });

  it('Error Handling: Allocation cap is enforced and returns 400', async () => {
    const { userId, accessToken } = await createUserAndGetAuth(
      'cap@example.com',
      'CapTest',
    );
    const accountId = await createAccount(accessToken, 'Main', 'BANK');
    const categoryId = await createCategory(accessToken, 'Income');
    const branchId = await createBranch(accessToken, 'Branch1');

    const txn = await createBankTransaction(accountId, 1000, 'INFLOW');
    const ledger1 = await createLedgerEntry(
      userId,
      categoryId,
      branchId,
      600,
      'INFLOW',
    );
    const ledger2 = await createLedgerEntry(
      userId,
      categoryId,
      branchId,
      500,
      'INFLOW',
    );

    await request(app.getHttpServer())
      .post('/api/v1/allocations')
      .set('Cookie', [accessToken])
      .send({
        bankTransactionId: txn.id,
        ledgerEntryId: ledger1.id,
        amountPortion: 600,
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/v1/allocations')
      .set('Cookie', [accessToken])
      .send({
        bankTransactionId: txn.id,
        ledgerEntryId: ledger2.id,
        amountPortion: 500,
      })
      .expect(400);

    const currentAllocated = await prisma.allocation.aggregate({
      _sum: { amountPortion: true },
      where: { bankTransactionId: txn.id, status: AllocationStatus.ACTIVE },
    });
    expect(
      parseFloat(currentAllocated._sum.amountPortion?.toString() || '0'),
    ).toBeCloseTo(600);
  });

  it('Concurrency: Multiple concurrent allocations on same transaction handled correctly', async () => {
    const { userId, accessToken } = await createUserAndGetAuth(
      'concurrent@example.com',
      'ConcurrentTest',
    );
    const accountId = await createAccount(accessToken, 'Main', 'BANK');
    const categoryId = await createCategory(accessToken, 'Income');
    const branchId = await createBranch(accessToken, 'Branch1');

    const txn = await createBankTransaction(accountId, 1000, 'INFLOW');
    const ledger1 = await createLedgerEntry(
      userId,
      categoryId,
      branchId,
      500,
      'INFLOW',
    );
    const ledger2 = await createLedgerEntry(
      userId,
      categoryId,
      branchId,
      500,
      'INFLOW',
    );
    const ledger3 = await createLedgerEntry(
      userId,
      categoryId,
      branchId,
      100,
      'INFLOW',
    );

    const allocatePromises = [
      request(app.getHttpServer())
        .post('/api/v1/allocations')
        .set('Cookie', [accessToken])
        .send({
          bankTransactionId: txn.id,
          ledgerEntryId: ledger1.id,
          amountPortion: 500,
        }),
      request(app.getHttpServer())
        .post('/api/v1/allocations')
        .set('Cookie', [accessToken])
        .send({
          bankTransactionId: txn.id,
          ledgerEntryId: ledger2.id,
          amountPortion: 500,
        }),
      request(app.getHttpServer())
        .post('/api/v1/allocations')
        .set('Cookie', [accessToken])
        .send({
          bankTransactionId: txn.id,
          ledgerEntryId: ledger3.id,
          amountPortion: 100,
        }),
    ];

    const results = await Promise.allSettled(allocatePromises);

    const successfulAllocations = results.filter(
      (r) => r.status === 'fulfilled' && r.value.statusCode === 201,
    );
    const failedAllocations = results.filter(
      (r) => r.status === 'fulfilled' && r.value.statusCode === 400,
    );

    expect(successfulAllocations.length).toBe(2);
    expect(failedAllocations.length).toBe(1);

    const currentAllocated = await prisma.allocation.aggregate({
      _sum: { amountPortion: true },
      where: { bankTransactionId: txn.id, status: AllocationStatus.ACTIVE },
    });
    expect(
      parseFloat(currentAllocated._sum.amountPortion?.toString() || '0'),
    ).toBeCloseTo(1000);

    const finalTxn = await prisma.bankTransaction.findUnique({
      where: { id: txn.id },
    });
    expect(finalTxn?.status).toBe(TransactionStatus.MATCHED);
  });

  it('Boundary: Allocation with zero amountPortion is rejected', async () => {
    const { userId, accessToken } = await createUserAndGetAuth(
      'zero@example.com',
      'ZeroAmountTest',
    );
    const accountId = await createAccount(accessToken, 'Main', 'BANK');
    const categoryId = await createCategory(accessToken, 'Income');
    const branchId = await createBranch(accessToken, 'Branch1');

    const txn = await createBankTransaction(accountId, 100, 'INFLOW');
    const ledger = await createLedgerEntry(
      userId,
      categoryId,
      branchId,
      0,
      'INFLOW',
    );

    await request(app.getHttpServer())
      .post('/api/v1/allocations')
      .set('Cookie', [accessToken])
      .send({
        bankTransactionId: txn.id,
        ledgerEntryId: ledger.id,
        amountPortion: 0,
      })
      .expect(400);
  });

  it('Boundary: Allocation with negative amountPortion is rejected', async () => {
    const { userId, accessToken } = await createUserAndGetAuth(
      'negative@example.com',
      'NegativeAmountTest',
    );
    const accountId = await createAccount(accessToken, 'Main', 'BANK');
    const categoryId = await createCategory(accessToken, 'Income');
    const branchId = await createBranch(accessToken, 'Branch1');

    const txn = await createBankTransaction(accountId, 100, 'INFLOW');
    const ledger = await createLedgerEntry(
      userId,
      categoryId,
      branchId,
      -10,
      'INFLOW',
    );

    await request(app.getHttpServer())
      .post('/api/v1/allocations')
      .set('Cookie', [accessToken])
      .send({
        bankTransactionId: txn.id,
        ledgerEntryId: ledger.id,
        amountPortion: -10,
      })
      .expect(400);
  });

  it('Boundary: Empty allocations array in batch request is rejected', async () => {
    const { accessToken } = await createUserAndGetAuth(
      'empty@example.com',
      'EmptyArrayTest',
    );

    await request(app.getHttpServer())
      .post('/api/v1/allocations')
      .set('Cookie', [accessToken])
      .send({ allocations: [] })
      .expect(400);
  });

  it('Boundary: Request without allocations data is rejected', async () => {
    const { accessToken } = await createUserAndGetAuth(
      'no-data@example.com',
      'NoDataTest',
    );

    await request(app.getHttpServer())
      .post('/api/v1/allocations')
      .set('Cookie', [accessToken])
      .send({})
      .expect(400);
  });
});
