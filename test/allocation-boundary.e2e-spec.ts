import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from './../src/app.module';
import { PrismaClient } from '@prisma/client';
import { PostgresTriggerExceptionFilter } from '../src/common/filters/postgres-trigger-exception.filter';

jest.setTimeout(30000);

describe('Allocation Boundary (e2e)', () => {
  let app: INestApplication;
  const prisma = new PrismaClient();
  let authCookie: string;
  let userId: string;
  let accountId: string;
  let categoryId: string;
  let branchId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true }),
    );
    app.useGlobalFilters(new PostgresTriggerExceptionFilter());
    await app.init();

    const regRes = await request(
      app.getHttpServer() as unknown as Parameters<typeof request>[0],
    )
      .post('/api/v1/auth/register')
      .send({
        email: `boundary-user-${Date.now()}@example.com`,
        password: 'Password1',
        name: 'Boundary User',
      });
    userId = (regRes.body as { id: string }).id;
    authCookie = (regRes.headers['set-cookie'] as unknown as string[]).find(
      (c) => c.startsWith('access_token='),
    )!;

    const account = await prisma.account.create({
      data: { name: 'Boundary Acc', type: 'BANK', userId },
    });
    accountId = account.id;
    const category = await prisma.category.create({
      data: { name: `Boundary Cat ${Date.now()}`, userId },
    });
    categoryId = category.id;
    const branch = await prisma.branch.create({
      data: { name: `Boundary Branch ${Date.now()}`, userId },
    });
    branchId = branch.id;
  });

  afterAll(async () => {
    await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
    await app.close();
  });

  const server = () =>
    app.getHttpServer() as unknown as Parameters<typeof request>[0];

  it('Test 1 (Revoke Idempotency): should fail to revoke an already revoked allocation', async () => {
    const tx = await prisma.bankTransaction.create({
      data: {
        accountId,
        amount: 100,
        txnDate: new Date(),
        type: 'INFLOW',
        description: 'Revoke test',
      },
    });
    const le = await prisma.ledgerEntry.create({
      data: {
        categoryId,
        branchId,
        userId,
        amount: 100,
        entryDate: new Date(),
        type: 'INFLOW',
      },
    });

    const createRes = await request(server())
      .post('/api/v1/allocations')
      .set('Cookie', authCookie)
      .send({
        allocations: [
          {
            bankTransactionId: tx.id,
            ledgerEntryId: le.id,
            amountPortion: 100,
          },
        ],
      })
      .expect(201);

    const allocationId = (createRes.body as { id: string }[])[0].id;

    // First revoke should succeed
    await request(server())
      .post(`/api/v1/allocations/${allocationId}/revoke`)
      .set('Cookie', authCookie)
      .expect(200);

    // Second revoke should fail
    await request(server())
      .post(`/api/v1/allocations/${allocationId}/revoke`)
      .set('Cookie', authCookie)
      .expect(400);

    // Cleanup
    await prisma.allocation.deleteMany({ where: { bankTransactionId: tx.id } });
    await prisma.bankTransaction.delete({ where: { id: tx.id } });
    await prisma.ledgerEntry.delete({ where: { id: le.id } });
  });

  it('Test 2 (AmountPortion: 0): should reject allocation with zero amount', async () => {
    const tx = await prisma.bankTransaction.create({
      data: {
        accountId,
        amount: 100,
        txnDate: new Date(),
        type: 'INFLOW',
        description: 'Zero amount',
      },
    });
    const le = await prisma.ledgerEntry.create({
      data: {
        categoryId,
        branchId,
        userId,
        amount: 100,
        entryDate: new Date(),
        type: 'INFLOW',
      },
    });

    await request(server())
      .post('/api/v1/allocations')
      .set('Cookie', authCookie)
      .send({
        allocations: [
          { bankTransactionId: tx.id, ledgerEntryId: le.id, amountPortion: 0 },
        ],
      })
      .expect(400);

    // Cleanup
    await prisma.bankTransaction.delete({ where: { id: tx.id } });
    await prisma.ledgerEntry.delete({ where: { id: le.id } });
  });

  it('Test 3 (AmountPortion: -100): should reject allocation with negative amount', async () => {
    const tx = await prisma.bankTransaction.create({
      data: {
        accountId,
        amount: 100,
        txnDate: new Date(),
        type: 'INFLOW',
        description: 'Negative amount',
      },
    });
    const le = await prisma.ledgerEntry.create({
      data: {
        categoryId,
        branchId,
        userId,
        amount: 100,
        entryDate: new Date(),
        type: 'INFLOW',
      },
    });

    await request(server())
      .post('/api/v1/allocations')
      .set('Cookie', authCookie)
      .send({
        allocations: [
          {
            bankTransactionId: tx.id,
            ledgerEntryId: le.id,
            amountPortion: -100,
          },
        ],
      })
      .expect(400); // ValidationPipe catches negative numbers

    // Cleanup
    await prisma.bankTransaction.delete({ where: { id: tx.id } });
    await prisma.ledgerEntry.delete({ where: { id: le.id } });
  });

  it('Test 4 (Ledger Delete with Active Alloc): should prevent deleting a ledger entry with active allocations', async () => {
    const tx = await prisma.bankTransaction.create({
      data: {
        accountId,
        amount: 100,
        txnDate: new Date(),
        type: 'INFLOW',
        description: 'Ledger delete',
      },
    });
    const le = await prisma.ledgerEntry.create({
      data: {
        categoryId,
        branchId,
        userId,
        amount: 100,
        entryDate: new Date(),
        type: 'INFLOW',
      },
    });

    const createRes = await request(server())
      .post('/api/v1/allocations')
      .set('Cookie', authCookie)
      .send({
        allocations: [
          {
            bankTransactionId: tx.id,
            ledgerEntryId: le.id,
            amountPortion: 100,
          },
        ],
      })
      .expect(201);
    const allocationId = (createRes.body as { id: string }[])[0].id;

    // Attempt to delete ledger entry while allocation is active -> fail
    await request(server())
      .delete(`/api/v1/ledger-entries/${le.id}`)
      .set('Cookie', authCookie)
      .expect(409);

    // Revoke the allocation
    await request(server())
      .post(`/api/v1/allocations/${allocationId}/revoke`)
      .set('Cookie', authCookie)
      .expect(200);

    // Still cannot delete — revoked allocations hold FK reference (audit trail)
    await request(server())
      .delete(`/api/v1/ledger-entries/${le.id}`)
      .set('Cookie', authCookie)
      .expect(409);

    // Cleanup
    await prisma.allocation.deleteMany({ where: { ledgerEntryId: le.id } });
    await prisma.bankTransaction.delete({ where: { id: tx.id } });
    await prisma.ledgerEntry.delete({ where: { id: le.id } });
  });
});
