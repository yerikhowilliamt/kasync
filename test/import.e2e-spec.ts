import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import * as path from 'path';
import { AppModule } from '../src/app.module';
import { PrismaClient } from '@prisma/client';
import { PostgresTriggerExceptionFilter } from '../src/common/filters/postgres-trigger-exception.filter';

jest.setTimeout(30000);

interface ImportResponse {
  totalParsed: number;
  importedCount: number;
  duplicateCount: number;
}

function server(app: INestApplication): Parameters<typeof request>[0] {
  return app.getHttpServer() as Parameters<typeof request>[0];
}

async function registerAndGetCookie(
  app: INestApplication,
  email: string,
): Promise<{ userId: string; authCookie: string }> {
  const res = await request(server(app))
    .post('/api/v1/auth/register')
    .send({ email, password: 'password123', name: 'Import Test User' });
  const userId = (res.body as { id: string }).id;
  const cookies = res.headers['set-cookie'] as unknown as string[];
  const authCookie = cookies.find((c) => c.startsWith('access_token='))!;
  return { userId, authCookie };
}

describe('ImportModule (e2e)', () => {
  let app: INestApplication;
  const prisma = new PrismaClient();

  let authCookie: string;
  let userId: string;
  let accountId: string;

  // userB for cross-user account test
  let userBAccountId: string;
  let userBId: string;

  const bcaFixturePath = path.resolve(__dirname, 'fixtures/bca-valid.csv');
  const mandiriFixturePath = path.resolve(
    __dirname,
    'fixtures/mandiri-valid.csv',
  );

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
    app.useGlobalFilters(new PostgresTriggerExceptionFilter());
    await app.init();

    // Register userA
    const userA = await registerAndGetCookie(
      app,
      `import-usera-${Date.now()}@example.com`,
    );
    userId = userA.userId;
    authCookie = userA.authCookie;

    const account = await prisma.account.create({
      data: {
        name: `Import E2E Account ${Date.now()}`,
        type: 'BANK',
        user: { connect: { id: userId } },
      },
    });
    accountId = account.id;

    // Register userB + account (for cross-user test)
    const userBRes = await registerAndGetCookie(
      app,
      `import-userb-${Date.now()}@example.com`,
    );
    userBId = userBRes.userId;

    const userBAccount = await prisma.account.create({
      data: {
        name: `Import E2E UserB Account ${Date.now()}`,
        type: 'BANK',
        user: { connect: { id: userBId } },
      },
    });
    userBAccountId = userBAccount.id;
  });

  afterAll(async () => {
    await prisma.bankTransaction.deleteMany({ where: { accountId } });
    await prisma.bankTransaction.deleteMany({
      where: { accountId: userBAccountId },
    });
    await prisma.account.delete({ where: { id: accountId } });
    await prisma.account.delete({ where: { id: userBAccountId } });
    await prisma.$disconnect();
    await app.close();
  });

  // Clean bank_transactions between tests that need a fresh state
  afterEach(async () => {
    await prisma.bankTransaction.deleteMany({ where: { accountId } });
  });

  describe('Happy path', () => {
    it('POST /import/csv - BCA CSV import succeeds', async () => {
      const res = await request(server(app))
        .post('/api/v1/import/csv')
        .set('Cookie', [authCookie])
        .field('accountId', accountId)
        .field('bankFormat', 'BCA')
        .attach('file', bcaFixturePath);

      expect(res.status).toBe(200);
      const body = res.body as ImportResponse;
      expect(body.totalParsed).toBe(2);
      expect(body.importedCount).toBe(2);
      expect(body.duplicateCount).toBe(0);
    });

    it('POST /import/csv - Mandiri CSV import succeeds', async () => {
      const res = await request(server(app))
        .post('/api/v1/import/csv')
        .set('Cookie', [authCookie])
        .field('accountId', accountId)
        .field('bankFormat', 'MANDIRI')
        .attach('file', mandiriFixturePath);

      expect(res.status).toBe(200);
      const body = res.body as ImportResponse;
      expect(body.totalParsed).toBe(2);
      expect(body.importedCount).toBe(2);
      expect(body.duplicateCount).toBe(0);
    });
  });

  describe('Duplicate / re-import', () => {
    it('BCA re-import: second import reports all rows as duplicates', async () => {
      // First import
      const first = await request(server(app))
        .post('/api/v1/import/csv')
        .set('Cookie', [authCookie])
        .field('accountId', accountId)
        .field('bankFormat', 'BCA')
        .attach('file', bcaFixturePath);

      expect(first.status).toBe(200);
      const firstBody = first.body as ImportResponse;
      expect(firstBody.importedCount).toBe(2);

      // Second import — same file
      const second = await request(server(app))
        .post('/api/v1/import/csv')
        .set('Cookie', [authCookie])
        .field('accountId', accountId)
        .field('bankFormat', 'BCA')
        .attach('file', bcaFixturePath);

      expect(second.status).toBe(200);
      const secondBody = second.body as ImportResponse;
      expect(secondBody.importedCount).toBe(0);
      expect(secondBody.duplicateCount).toBe(firstBody.importedCount);
    });

    it('Mandiri re-import: externalRef unique constraint blocks all duplicates', async () => {
      // First import
      const first = await request(server(app))
        .post('/api/v1/import/csv')
        .set('Cookie', [authCookie])
        .field('accountId', accountId)
        .field('bankFormat', 'MANDIRI')
        .attach('file', mandiriFixturePath);

      expect(first.status).toBe(200);
      expect((first.body as ImportResponse).importedCount).toBe(2);

      // Second import — same file, externalRef rows blocked by @@unique([accountId, externalRef])
      const second = await request(server(app))
        .post('/api/v1/import/csv')
        .set('Cookie', [authCookie])
        .field('accountId', accountId)
        .field('bankFormat', 'MANDIRI')
        .attach('file', mandiriFixturePath);

      expect(second.status).toBe(200);
      const secondBody = second.body as ImportResponse;
      expect(secondBody.importedCount).toBe(0);
      expect(secondBody.duplicateCount).toBe(2);
    });
  });

  describe('Error cases', () => {
    it('POST /import/csv - wrong accountId (belongs to userB) → 404', async () => {
      const res = await request(server(app))
        .post('/api/v1/import/csv')
        .set('Cookie', [authCookie])
        .field('accountId', userBAccountId)
        .field('bankFormat', 'BCA')
        .attach('file', bcaFixturePath);

      expect(res.status).toBe(404);
    });

    it('POST /import/csv - invalid bankFormat "HSBC" → 400', async () => {
      const res = await request(server(app))
        .post('/api/v1/import/csv')
        .set('Cookie', [authCookie])
        .field('accountId', accountId)
        .field('bankFormat', 'HSBC')
        .attach('file', bcaFixturePath);

      expect(res.status).toBe(400);
    });

    it('POST /import/csv - trailing space "BCA " fails IsIn validation → 400', async () => {
      const res = await request(server(app))
        .post('/api/v1/import/csv')
        .set('Cookie', [authCookie])
        .field('accountId', accountId)
        .field('bankFormat', 'BCA ')
        .attach('file', bcaFixturePath);

      expect(res.status).toBe(400);
    });

    it('POST /import/csv - missing file → 400', async () => {
      const res = await request(server(app))
        .post('/api/v1/import/csv')
        .set('Cookie', [authCookie])
        .field('accountId', accountId)
        .field('bankFormat', 'BCA');

      expect(res.status).toBe(400);
    });

    it('POST /import/csv - file exceeds 5MB → 400', async () => {
      // Generate a buffer just over 5MB
      const oversized = Buffer.alloc(5 * 1024 * 1024 + 1, '0');

      const res = await request(server(app))
        .post('/api/v1/import/csv')
        .set('Cookie', [authCookie])
        .field('accountId', accountId)
        .field('bankFormat', 'BCA')
        .attach('file', oversized, {
          filename: 'big.csv',
          contentType: 'text/csv',
        });

      expect(res.status).toBe(400);
    });

    it('POST /import/csv - unauthenticated request → 401', async () => {
      const res = await request(server(app))
        .post('/api/v1/import/csv')
        .field('accountId', accountId)
        .field('bankFormat', 'BCA')
        .attach('file', bcaFixturePath);

      expect(res.status).toBe(401);
    });

    it('POST /import/csv - empty CSV (no data rows) → all counts zero', async () => {
      const emptyBuffer = Buffer.from('');

      const res = await request(server(app))
        .post('/api/v1/import/csv')
        .set('Cookie', [authCookie])
        .field('accountId', accountId)
        .field('bankFormat', 'BCA')
        .attach('file', emptyBuffer, {
          filename: 'empty.csv',
          contentType: 'text/csv',
        });

      expect(res.status).toBe(200);
      const body = res.body as ImportResponse;
      expect(body.totalParsed).toBe(0);
      expect(body.importedCount).toBe(0);
      expect(body.duplicateCount).toBe(0);
    });
  });
});
