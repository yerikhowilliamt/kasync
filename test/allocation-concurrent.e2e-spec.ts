import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from './../src/app.module';
import { PrismaClient } from '@prisma/client';
import { PostgresTriggerExceptionFilter } from '../src/common/filters/postgres-trigger-exception.filter';
import { Decimal } from '@prisma/client/runtime/library';

jest.setTimeout(30000);

describe('Allocation Concurrent (e2e)', () => {
  let app: INestApplication;
  const prisma = new PrismaClient();

  let authCookie: string;
  let userId: string;
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
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    app.useGlobalFilters(new PostgresTriggerExceptionFilter());
    await app.init();

    // Register user
    const regRes = await request(
      app.getHttpServer() as unknown as Parameters<typeof request>[0],
    )
      .post('/api/v1/auth/register')
      .send({
        email: `concurrent-user-${Date.now()}@example.com`,
        password: 'password123',
        name: 'Concurrent User',
      });
    userId = (regRes.body as { id: string }).id;
    const cookies = regRes.headers['set-cookie'] as unknown as string[];
    authCookie = cookies.find((c) => c.startsWith('access_token='))!;

    // Setup related entities
    const account = await prisma.account.create({
      data: { name: 'Concurrent Account', type: 'BANK', userId },
    });
    accountId = account.id;

    const category = await prisma.category.create({
      data: { name: `Concurrent Category ${Date.now()}`, userId },
    });
    categoryId = category.id;

    const branch = await prisma.branch.create({
      data: { name: `Concurrent Branch ${Date.now()}`, userId },
    });
    branchId = branch.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
    await app.close();
  });

  it('should handle concurrent allocation requests correctly', async () => {
    // 1. Create Bank Transaction and Ledger Entries
    const bankTransaction = await prisma.bankTransaction.create({
      data: {
        accountId,
        txnDate: new Date(),
        amount: 1000,
        type: 'INFLOW',
        description: 'Concurrent Test Tx',
        status: 'UNRESOLVED',
      },
    });
    bankTransactionId = bankTransaction.id;

    const ledgerEntry1 = await prisma.ledgerEntry.create({
      data: {
        categoryId,
        branchId,
        userId,
        entryDate: new Date(),
        amount: 700,
        type: 'INFLOW',
      },
    });
    ledgerEntryId1 = ledgerEntry1.id;

    const ledgerEntry2 = await prisma.ledgerEntry.create({
      data: {
        categoryId,
        branchId,
        userId,
        entryDate: new Date(),
        amount: 700,
        type: 'INFLOW',
      },
    });
    ledgerEntryId2 = ledgerEntry2.id;

    // 2. Fire two simultaneous allocation requests
    const server = app.getHttpServer() as unknown as Parameters<
      typeof request
    >[0];
    const request1 = request(server)
      .post('/api/v1/allocations')
      .set('Cookie', [authCookie])
      .send({
        allocations: [
          {
            bankTransactionId,
            ledgerEntryId: ledgerEntryId1,
            amountPortion: 700,
          },
        ],
      });

    const request2 = request(server)
      .post('/api/v1/allocations')
      .set('Cookie', [authCookie])
      .send({
        allocations: [
          {
            bankTransactionId,
            ledgerEntryId: ledgerEntryId2,
            amountPortion: 700,
          },
        ],
      });

    const [result1, result2] = await Promise.allSettled([request1, request2]);

    // 3. Assert one success, one failure
    const statuses = [
      result1.status === 'fulfilled' ? result1.value.status : 0,
      result2.status === 'fulfilled' ? result2.value.status : 0,
    ].sort();

    expect(statuses).toEqual([201, 400]);

    // 4. Assert final state in DB
    const allocations = await prisma.allocation.findMany({
      where: { bankTransactionId, status: 'ACTIVE' },
    });
    expect(allocations).toHaveLength(1);
    expect(allocations[0].amountPortion).toEqual(new Decimal(700));

    const totalAllocated = await prisma.allocation.aggregate({
      _sum: { amountPortion: true },
      where: { bankTransactionId, status: 'ACTIVE' },
    });
    expect(totalAllocated._sum.amountPortion?.toNumber()).toBe(700);

    const tx = await prisma.bankTransaction.findUnique({
      where: { id: bankTransactionId },
    });
    expect(tx?.status).toBe('PARTIALLY_ALLOCATED');

    // Cleanup for this test
    await prisma.allocation.deleteMany({ where: { bankTransactionId } });
    await prisma.bankTransaction.delete({ where: { id: bankTransactionId } });
    await prisma.ledgerEntry.deleteMany({
      where: { id: { in: [ledgerEntryId1, ledgerEntryId2] } },
    });
  });
});
