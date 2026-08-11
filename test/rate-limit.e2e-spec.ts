import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';

jest.setTimeout(60000);

describe('Rate Limiting (e2e)', () => {
  let app: INestApplication;

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
  });

  afterAll(async () => {
    await app.close();
  });

  it('should trigger rate limit for registration after 10 requests', async () => {
    const email = `ratelimit-user-${Date.now()}@example.com`;
    const server = app.getHttpServer() as unknown as Parameters<
      typeof request
    >[0];

    const requests = [];
    for (let i = 0; i < 11; i++) {
      requests.push(
        request(server)
          .post('/api/v1/auth/register')
          .send({ email, password: 'Password1', name: 'Rate Limit Test' }),
      );
    }

    const responses = await Promise.all(requests);

    const statusCodes = responses.map((res) => res.status);
    const successCount = statusCodes.filter((s) => s === 201).length;
    const rateLimitCount = statusCodes.filter((s) => s === 429).length;

    expect(successCount).toBeLessThanOrEqual(10);
    expect(rateLimitCount).toBeGreaterThanOrEqual(1);
  });
});
