import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';

describe('AuthModule (e2e)', () => {
  let app: INestApplication;
  const testUser = {
    email: `auth-test-${Date.now()}@example.com`,
    password: 'password123',
    name: 'Auth Test User',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /auth/register - registers user and sets cookies', async () => {
    const response = await request(
      app.getHttpServer() as unknown as Parameters<typeof request>[0],
    )
      .post('/auth/register')
      .send(testUser)
      .expect(201);

    expect(response.body).toHaveProperty('id');
    expect((response.body as { email: string }).email).toBe(testUser.email);
    expect(response.headers['set-cookie']).toBeDefined();

    const cookies = response.headers['set-cookie'] as unknown as string[];
    expect(cookies.some((c) => c.includes('access_token'))).toBe(true);
    expect(cookies.some((c) => c.includes('refresh_token'))).toBe(true);
  });

  it('POST /auth/login - authenticates user', async () => {
    const response = await request(
      app.getHttpServer() as unknown as Parameters<typeof request>[0],
    )
      .post('/auth/login')
      .send({
        email: testUser.email,
        password: testUser.password,
      })
      .expect(200);

    expect((response.body as { email: string }).email).toBe(testUser.email);
    expect(response.headers['set-cookie']).toBeDefined();
  });

  it('POST /auth/refresh - refreshes access token via refresh cookie', async () => {
    const loginRes = await request(
      app.getHttpServer() as unknown as Parameters<typeof request>[0],
    )
      .post('/auth/login')
      .send({
        email: testUser.email,
        password: testUser.password,
      });

    const cookies = loginRes.headers['set-cookie'] as unknown as string[];
    const refreshCookie = cookies.find((c) => c.startsWith('refresh_token='));

    const refreshRes = await request(
      app.getHttpServer() as unknown as Parameters<typeof request>[0],
    )
      .post('/auth/refresh')
      .set('Cookie', [refreshCookie!])
      .expect(200);

    expect(refreshRes.body).toEqual({ message: 'Token refreshed' });
    expect(refreshRes.headers['set-cookie']).toBeDefined();
  });

  it('GET /accounts - blocks request without token cookie or header', async () => {
    await request(
      app.getHttpServer() as unknown as Parameters<typeof request>[0],
    )
      .get('/accounts')
      .expect(401);
  });

  it('GET /accounts - allows access with valid access_token cookie', async () => {
    const loginRes = await request(
      app.getHttpServer() as unknown as Parameters<typeof request>[0],
    )
      .post('/auth/login')
      .send({
        email: testUser.email,
        password: testUser.password,
      });

    const cookies = loginRes.headers['set-cookie'] as unknown as string[];
    const accessCookie = cookies.find((c) => c.startsWith('access_token='));

    await request(
      app.getHttpServer() as unknown as Parameters<typeof request>[0],
    )
      .get('/accounts')
      .set('Cookie', [accessCookie!])
      .expect(200);
  });
});
