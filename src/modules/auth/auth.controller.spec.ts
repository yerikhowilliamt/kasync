import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import type { Request, Response } from 'express';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: Record<string, jest.Mock>;

  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    name: 'Test User',
  };
  const mockTokens = { accessToken: 'acc-token', refreshToken: 'ref-token' };

  beforeEach(async () => {
    authService = {
      register: jest
        .fn()
        .mockResolvedValue({ user: mockUser, tokens: mockTokens }),
      login: jest
        .fn()
        .mockResolvedValue({ user: mockUser, tokens: mockTokens }),
      refreshTokens: jest.fn().mockResolvedValue(mockTokens),
      logout: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should register user and set cookies', async () => {
    const res = { cookie: jest.fn() } as unknown as Response;
    const result = await controller.register(
      { email: 'test@example.com', password: 'password123', name: 'Test User' },
      res,
    );

    expect(result).toEqual(mockUser);
    /* eslint-disable @typescript-eslint/unbound-method */
    expect(res.cookie).toHaveBeenCalledWith(
      'access_token',
      'acc-token',
      expect.any(Object),
    );
    expect(res.cookie).toHaveBeenCalledWith(
      'refresh_token',
      'ref-token',
      expect.any(Object),
    );
    /* eslint-enable @typescript-eslint/unbound-method */
  });

  it('should login user and set cookies', async () => {
    const res = { cookie: jest.fn() } as unknown as Response;
    const result = await controller.login(
      { email: 'test@example.com', password: 'password123' },
      res,
    );

    expect(result).toEqual(mockUser);
    /* eslint-disable @typescript-eslint/unbound-method */
    expect(res.cookie).toHaveBeenCalledWith(
      'access_token',
      'acc-token',
      expect.any(Object),
    );
    /* eslint-enable @typescript-eslint/unbound-method */
  });

  it('should refresh tokens using refresh cookie', async () => {
    const req = {
      cookies: { refresh_token: 'ref-token' },
    } as unknown as Request;
    const res = { cookie: jest.fn() } as unknown as Response;
    const result = await controller.refresh(req, res);

    expect(result).toEqual({ message: 'Token refreshed' });
    expect(authService.refreshTokens).toHaveBeenCalledWith('ref-token');
  });

  it('should logout user and clear cookies', async () => {
    const res = { clearCookie: jest.fn() } as unknown as Response;
    const result = await controller.logout('user-1', res);

    expect(result).toEqual({ message: 'Logged out successfully' });
    expect(authService.logout).toHaveBeenCalledWith('user-1');
    /* eslint-disable @typescript-eslint/unbound-method */
    expect(res.clearCookie).toHaveBeenCalledWith(
      'access_token',
      expect.any(Object),
    );
    /* eslint-enable @typescript-eslint/unbound-method */
  });
});
