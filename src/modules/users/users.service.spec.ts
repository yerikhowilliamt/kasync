import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UsersService } from './users.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { STORAGE_PROVIDER } from '../../common/storage/storage-provider.interface';

describe('UsersService', () => {
  let service: UsersService;

  const mockUser = {
    id: 'usr-1',
    email: 'test@example.com',
    name: 'Test User',
    passwordHash: '',
    refreshTokenHash: 'hash',
    photoUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  const mockStorageProvider = {
    uploadImage: jest.fn(),
    uploadFile: jest.fn(),
  };

  beforeEach(async () => {
    mockUser.passwordHash = await bcrypt.hash('OldPassword123!', 10);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: STORAGE_PROVIDER, useValue: mockStorageProvider },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    jest.clearAllMocks();
  });

  describe('getProfile', () => {
    it('should return user profile when found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.getProfile('usr-1');

      expect(result).toEqual({
        id: 'usr-1',
        email: 'test@example.com',
        name: 'Test User',
        photoUrl: null,
      });
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'usr-1' },
      });
    });

    it('should throw NotFoundException if user is not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.getProfile('usr-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updatePassword', () => {
    it('should update password successfully when old password is correct', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.user.update.mockResolvedValue({ ...mockUser });

      const result = await service.updatePassword('usr-1', {
        oldPassword: 'OldPassword123!',
        newPassword: 'NewPassword123!',
      });

      expect(result).toEqual({ message: 'Password updated successfully' });
      expect(mockPrismaService.user.update).toHaveBeenCalled();
    });

    it('should throw UnauthorizedException if old password is invalid', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      await expect(
        service.updatePassword('usr-1', {
          oldPassword: 'WrongPassword!',
          newPassword: 'NewPassword123!',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw NotFoundException if user does not exist', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(
        service.updatePassword('non-existent', {
          oldPassword: 'OldPassword123!',
          newPassword: 'NewPassword123!',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updatePhotoProfile', () => {
    it('should upload photo to Cloudinary and update photoUrl in user table', async () => {
      const mockFile = {
        buffer: Buffer.from('fake-image-content'),
      } as Express.Multer.File;

      mockStorageProvider.uploadImage.mockResolvedValue({
        url: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
      });

      mockPrismaService.user.update.mockResolvedValue({
        ...mockUser,
        photoUrl: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
      });

      const result = await service.updatePhotoProfile('usr-1', mockFile);

      expect(mockStorageProvider.uploadImage).toHaveBeenCalledWith(
        mockFile,
        'profile_photos',
      );
      expect(result).toEqual({
        id: 'usr-1',
        email: 'test@example.com',
        name: 'Test User',
        photoUrl: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
      });
    });

    it('should throw BadRequestException if file is missing', async () => {
      await expect(
        service.updatePhotoProfile(
          'usr-1',
          undefined as unknown as Express.Multer.File,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('deleteAccount', () => {
    it('should delete user account', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.user.delete.mockResolvedValue(mockUser);

      const result = await service.deleteAccount('usr-1');

      expect(result).toEqual({ message: 'Account deleted successfully' });
      expect(mockPrismaService.user.delete).toHaveBeenCalledWith({
        where: { id: 'usr-1' },
      });
    });

    it('should throw NotFoundException if user is not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.deleteAccount('usr-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
