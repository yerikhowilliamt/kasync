import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { CloudinaryService } from '../src/common/cloudinary/cloudinary.service';

import { STORAGE_PROVIDER } from '../src/common/storage/storage-provider.interface';

describe('Users (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authCookie: string;
  let userId: string;

  const mockCloudinaryService = {
    uploadImage: jest.fn().mockResolvedValue({
      url: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
    }),
    uploadFile: jest.fn().mockResolvedValue({
      url: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
    }),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(CloudinaryService)
      .useValue(mockCloudinaryService)
      .overrideProvider(STORAGE_PROVIDER)
      .useValue(mockCloudinaryService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    prisma = app.get(PrismaService);
    await prisma.user.deleteMany({
      where: { email: { in: ['user-e2e@example.com'] } },
    });

    const regRes = await request(
      app.getHttpServer() as unknown as Parameters<typeof request>[0],
    )
      .post('/api/v1/auth/register')
      .send({
        email: 'user-e2e@example.com',
        name: 'E2E User',
        password: 'Password123!',
      });

    userId = (regRes.body as { id: string }).id;
    const cookies = regRes.headers['set-cookie'] as unknown as string[];
    authCookie = cookies.find((c) => c.startsWith('access_token=')) || '';
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.user.deleteMany({
        where: { email: { in: ['user-e2e@example.com'] } },
      });
      await prisma.$disconnect();
    }
    if (app) {
      await app.close();
    }
  });

  describe('PATCH /users/me/password', () => {
    it('should fail if old password is incorrect', async () => {
      await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .patch('/api/v1/users/me/password')
        .set('Cookie', [authCookie])
        .send({
          oldPassword: 'WrongPassword!',
          newPassword: 'NewPassword123!',
        })
        .expect(401);
    });

    it('should update password successfully', async () => {
      await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .patch('/api/v1/users/me/password')
        .set('Cookie', [authCookie])
        .send({
          oldPassword: 'Password123!',
          newPassword: 'NewPassword123!',
        })
        .expect(200);
    });
  });

  describe('POST /users/me/photo', () => {
    it('should upload profile photo via Cloudinary', async () => {
      const res = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post('/api/v1/users/me/photo')
        .set('Cookie', [authCookie])
        .attach(
          'file',
          Buffer.from([
            0xff,
            0xd8,
            0xff,
            0xe0,
            ...Buffer.from('fake-image-data'),
          ]),
          {
            filename: 'avatar.jpg',
            contentType: 'image/jpeg',
          },
        )
        .expect(200);

      expect(res.body).toEqual(
        expect.objectContaining({
          id: userId,
          photoUrl: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
        }),
      );
    });
  });

  describe('DELETE /users/me', () => {
    it('should delete user account and clear auth cookies', async () => {
      const res = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .delete('/api/v1/users/me')
        .set('Cookie', [authCookie])
        .expect(200);

      expect(res.body).toEqual({ message: 'Account deleted successfully' });

      const deletedUser = await prisma.user.findUnique({
        where: { id: userId },
      });
      expect(deletedUser).toBeNull();
    });
  });
});
