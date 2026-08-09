import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController', () => {
  let controller: UsersController;

  const mockUsersService = {
    getProfile: jest.fn(),
    updatePassword: jest.fn(),
    updatePhotoProfile: jest.fn(),
    deleteAccount: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: mockUsersService }],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    jest.clearAllMocks();
  });

  it('should call getProfile service method', async () => {
    const profile = {
      id: 'usr-1',
      email: 'test@example.com',
      name: 'Test User',
      photoUrl: null,
    };
    mockUsersService.getProfile.mockResolvedValue(profile);

    const res = await controller.getProfile('usr-1');
    expect(mockUsersService.getProfile).toHaveBeenCalledWith('usr-1');
    expect(res).toEqual(profile);
  });

  it('should call updatePassword service method', async () => {
    mockUsersService.updatePassword.mockResolvedValue({
      message: 'Password updated successfully',
    });
    const dto = { oldPassword: 'Old', newPassword: 'NewPassword123!' };

    const res = await controller.updatePassword('usr-1', dto);
    expect(mockUsersService.updatePassword).toHaveBeenCalledWith('usr-1', dto);
    expect(res).toEqual({ message: 'Password updated successfully' });
  });

  it('should call updatePhotoProfile service method', async () => {
    mockUsersService.updatePhotoProfile.mockResolvedValue({
      id: 'usr-1',
      email: 'test@example.com',
      name: 'Test User',
      photoUrl: 'https://cloudinary.com/photo.jpg',
    });
    const mockFile = {} as Express.Multer.File;

    const res = await controller.updatePhotoProfile('usr-1', mockFile);
    expect(mockUsersService.updatePhotoProfile).toHaveBeenCalledWith(
      'usr-1',
      mockFile,
    );
    expect(res).toEqual({
      id: 'usr-1',
      email: 'test@example.com',
      name: 'Test User',
      photoUrl: 'https://cloudinary.com/photo.jpg',
    });
  });

  it('should delete account and clear auth cookies', async () => {
    mockUsersService.deleteAccount.mockResolvedValue({
      message: 'Account deleted successfully',
    });
    let clearCookieCount = 0;
    const resMock = {
      clearCookie: () => {
        clearCookieCount++;
      },
    } as unknown as Parameters<typeof controller.deleteAccount>[1];

    const res = await controller.deleteAccount('usr-1', resMock);
    expect(mockUsersService.deleteAccount).toHaveBeenCalledWith('usr-1');
    expect(clearCookieCount).toBe(2);
    expect(res).toEqual({ message: 'Account deleted successfully' });
  });
});
