import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '../../common/prisma/prisma.service';

jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.JWT_SECRET = 'test-access-secret';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
  });

  afterEach(() => {
    process.env = originalEnv;
  });
  let prismaService: {
    user: {
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };
  let jwtService: {
    signAsync: jest.Mock;
    verifyAsync: jest.Mock;
  };

  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    name: 'Test User',
    passwordHash: 'hashed-password',
    refreshTokenHash: 'hashed-refresh-token',
  };

  beforeEach(async () => {
    prismaService = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    jwtService = {
      signAsync: jest
        .fn()
        .mockImplementation(
          (
            _payload: unknown,
            options: { secret?: string; expiresIn?: string },
          ) => {
            if (
              options.secret?.includes('refresh') ||
              options.expiresIn === '30d'
            ) {
              return Promise.resolve('mock-refresh-token');
            }
            return Promise.resolve('mock-access-token');
          },
        ),
      verifyAsync: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaService },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('register', () => {
    it('should register a new user and return tokens', async () => {
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      prismaService.user.findUnique.mockResolvedValue(null);
      prismaService.user.create.mockResolvedValue(mockUser);
      prismaService.user.update.mockResolvedValue(mockUser);

      const result = await service.register({
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
      });

      expect(result.user).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        name: mockUser.name,
      });
      expect(result.tokens).toEqual({
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
      });
    });

    it('should throw ConflictException if email is already registered', async () => {
      prismaService.user.findUnique.mockResolvedValue(mockUser);

      await expect(
        service.register({
          email: 'test@example.com',
          password: 'password123',
          name: 'Test User',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('should authenticate user and return tokens on valid credentials', async () => {
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      prismaService.user.update.mockResolvedValue(mockUser);

      const result = await service.login({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result.user).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        name: mockUser.name,
      });
      expect(result.tokens.accessToken).toBe('mock-access-token');
    });

    it('should throw UnauthorizedException for invalid email or password', async () => {
      prismaService.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({
          email: 'invalid@example.com',
          password: 'password123',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refreshTokens', () => {
    it('should issue new tokens if refresh token is valid and matches DB hash', async () => {
      jwtService.verifyAsync.mockResolvedValue({
        sub: mockUser.id,
        email: mockUser.email,
      });
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      prismaService.user.update.mockResolvedValue(mockUser);

      const tokens = await service.refreshTokens('valid-refresh-token');
      expect(tokens.accessToken).toBe('mock-access-token');
      expect(tokens.refreshToken).toBe('mock-refresh-token');
    });

    it('should throw UnauthorizedException if refresh token is missing or invalid', async () => {
      await expect(service.refreshTokens('')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('logout', () => {
    it('should clear refresh token hash and set tokenValidFrom in DB', async () => {
      prismaService.user.update.mockResolvedValue(mockUser);

      await service.logout(mockUser.id);
      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: {
          refreshTokenHash: null,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          tokenValidFrom: expect.any(Date),
        },
      });
    });
  });
});
