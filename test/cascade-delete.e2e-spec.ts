import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { PrismaClient } from '@prisma/client';

jest.setTimeout(30000);

describe('Cascade Deletion (e2e)', () => {
  let app: INestApplication;
  const prisma = new PrismaClient();
  let authCookie: string;
  let userId: string;
  let accountId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    const regRes = await request(
      app.getHttpServer() as unknown as Parameters<typeof request>[0],
    )
      .post('/api/v1/auth/register')
      .send({
        email: `cascade-delete-user-${Date.now()}@example.com`,
        password: 'Password1',
        name: 'Cascade Delete User',
      });
    userId = (regRes.body as { id: string }).id;
    authCookie = (regRes.headers['set-cookie'] as unknown as string[]).find(
      (c) => c.startsWith('access_token='),
    )!;

    const account = await prisma.account.create({
      data: { name: 'Cascade Test Account', type: 'BANK', userId },
    });
    accountId = account.id;

    await prisma.bankTransaction.create({
      data: {
        accountId,
        amount: 100,
        txnDate: new Date(),
        type: 'INFLOW',
        description: 'Cascade test transaction',
      },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  it('should successfully delete a user and cascade delete all related data', async () => {
    // Attempt to delete the user
    await request(
      app.getHttpServer() as unknown as Parameters<typeof request>[0],
    )
      .delete('/api/v1/users/me')
      .set('Cookie', authCookie)
      .expect(200);

    // Verify user is deleted
    const user = await prisma.user.findUnique({ where: { id: userId } });
    expect(user).toBeNull();

    // Verify account is deleted due to cascade
    const account = await prisma.account.findUnique({
      where: { id: accountId },
    });
    expect(account).toBeNull();

    // Verify bank transactions are deleted due to cascade
    const txns = await prisma.bankTransaction.count({ where: { accountId } });
    expect(txns).toBe(0);
  });
});
