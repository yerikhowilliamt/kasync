import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from './../src/app.module';
import { PrismaClient } from '@prisma/client';
import { PostgresTriggerExceptionFilter } from '../src/common/filters/postgres-trigger-exception.filter';

jest.setTimeout(30000);

describe('Authorization (e2e)', () => {
  let app: INestApplication;
  const prisma = new PrismaClient();

  let userA: { id: string; email: string; name: string },
    userB: { id: string; email: string; name: string };
  let authCookieA: string, authCookieB: string;

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

    // Register User A
    const resA = await request(
      app.getHttpServer() as unknown as Parameters<typeof request>[0],
    )
      .post('/api/v1/auth/register')
      .send({
        email: `auth-usera-${Date.now()}@example.com`,
        password: 'Password1',
        name: 'User A',
      });
    userA = resA.body as { id: string; email: string; name: string };
    authCookieA = (resA.headers['set-cookie'] as unknown as string[]).find(
      (c) => c.startsWith('access_token='),
    )!;

    // Register User B
    const resB = await request(
      app.getHttpServer() as unknown as Parameters<typeof request>[0],
    )
      .post('/api/v1/auth/register')
      .send({
        email: `auth-userb-${Date.now()}@example.com`,
        password: 'Password1',
        name: 'User B',
      });
    userB = resB.body as { id: string; email: string; name: string };
    authCookieB = (resB.headers['set-cookie'] as unknown as string[]).find(
      (c) => c.startsWith('access_token='),
    )!;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { id: { in: [userA.id, userB.id] } },
    });
    await prisma.$disconnect();
    await app.close();
  });

  it('Test 1: should prevent allocation across users (404)', async () => {
    const accountA = await prisma.account.create({
      data: { name: 'Acc A', type: 'BANK', userId: userA.id },
    });
    const categoryA = await prisma.category.create({
      data: { name: `Cat A ${Date.now()}`, userId: userA.id },
    });
    const branchB = await prisma.branch.create({
      data: { name: `Branch B ${Date.now()}`, userId: userB.id },
    });
    const txnA = await prisma.bankTransaction.create({
      data: {
        accountId: accountA.id,
        amount: 100,
        txnDate: new Date(),
        type: 'INFLOW',
        description: 'Tx A',
      },
    });
    const ledgerB = await prisma.ledgerEntry.create({
      data: {
        amount: 100,
        entryDate: new Date(),
        type: 'INFLOW',
        userId: userB.id,
        categoryId: categoryA.id,
        branchId: branchB.id,
      },
    });

    await request(
      app.getHttpServer() as unknown as Parameters<typeof request>[0],
    )
      .post('/api/v1/allocations')
      .set('Cookie', authCookieA)
      .send({
        allocations: [
          {
            bankTransactionId: txnA.id,
            ledgerEntryId: ledgerB.id,
            amountPortion: 100,
          },
        ],
      })
      .expect(404);

    // Cleanup
    await prisma.bankTransaction.delete({ where: { id: txnA.id } });
    await prisma.ledgerEntry.delete({ where: { id: ledgerB.id } });
    await prisma.account.delete({ where: { id: accountA.id } });
    await prisma.category.delete({ where: { id: categoryA.id } });
    await prisma.branch.delete({ where: { id: branchB.id } });
  });

  it('Test 2: should return empty array for inaccessible transaction allocations', async () => {
    const accountA = await prisma.account.create({
      data: { name: 'Acc A', type: 'BANK', userId: userA.id },
    });
    const txnA = await prisma.bankTransaction.create({
      data: {
        accountId: accountA.id,
        amount: 100,
        txnDate: new Date(),
        type: 'INFLOW',
        description: 'Tx A',
      },
    });

    await request(
      app.getHttpServer() as unknown as Parameters<typeof request>[0],
    )
      .get(`/api/v1/allocations/transaction/${txnA.id}`)
      .set('Cookie', authCookieB) // User B tries to access User A's transaction allocations
      .expect(200)
      .then((res) => {
        expect(res.body).toEqual([]);
      });

    // Cleanup
    await prisma.bankTransaction.delete({ where: { id: txnA.id } });
    await prisma.account.delete({ where: { id: accountA.id } });
  });

  it('Test 3: should reject refresh after logout (401)', async () => {
    const server = app.getHttpServer() as unknown as Parameters<
      typeof request
    >[0];
    const userEmail = `logout-user-${Date.now()}@example.com`;
    const regRes = await request(server)
      .post('/api/v1/auth/register')
      .send({ email: userEmail, password: 'Password1', name: 'Logout Test' });

    const refreshCookie = (
      regRes.headers['set-cookie'] as unknown as string[]
    ).find((c) => c.startsWith('refresh_token='))!;

    // Logout clears refreshTokenHash in DB
    await request(server)
      .post('/api/v1/auth/logout')
      .set('Cookie', [
        (regRes.headers['set-cookie'] as unknown as string[]).find((c) =>
          c.startsWith('access_token='),
        )!,
      ])
      .expect(200);

    // Attempt to refresh using the now-invalidated refresh token
    await request(server)
      .post('/api/v1/auth/refresh')
      .set('Cookie', [refreshCookie])
      .expect(401);

    // Cleanup
    await prisma.user.delete({ where: { email: userEmail } });
  });

  it('Test 4: should handle concurrent registration with same email (one 201, one 409)', async () => {
    const server = app.getHttpServer() as unknown as Parameters<
      typeof request
    >[0];
    const email = `concurrent-reg-${Date.now()}@example.com`;

    const req = () =>
      request(server)
        .post('/api/v1/auth/register')
        .send({ email, password: 'Password1', name: 'Concurrent Reg' });

    const [res1, res2] = await Promise.allSettled([req(), req()]);

    const statuses = [
      res1.status === 'fulfilled' ? res1.value.status : 0,
      res2.status === 'fulfilled' ? res2.value.status : 0,
    ].sort();

    expect(statuses).toEqual([201, 409]);

    const userCount = await prisma.user.count({ where: { email } });
    expect(userCount).toBe(1);

    // Cleanup
    await prisma.user.delete({ where: { email } });
  });
});
