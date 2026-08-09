import { Test, TestingModule } from '@nestjs/testing';
import { CategoriesService } from './categories.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('CategoriesService', () => {
  let service: CategoriesService;
  let prisma: PrismaService;
  const testUserId = 'user-123';

  const mockCategory = {
    id: 'test-id',
    name: 'test-category',
    userId: testUserId,
    ledgerEntries: [],
  };

  const mockPrismaService = {
    category: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriesService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<CategoriesService>(CategoriesService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => expect(service).toBeDefined());

  describe('create', () => {
    it('should create a category', async () => {
      mockPrismaService.category.create.mockResolvedValue(mockCategory);
      const result = await service.create(
        { name: 'test-category' },
        testUserId,
      );
      expect(result).toEqual(mockCategory);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(prisma.category.create).toHaveBeenCalledWith({
        data: { name: 'test-category', user: { connect: { id: testUserId } } },
      });
    });
  });

  describe('findAll', () => {
    it('should return categories for a user', async () => {
      mockPrismaService.category.findMany.mockResolvedValue([mockCategory]);
      const result = await service.findAll(testUserId);
      expect(result).toEqual([mockCategory]);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(prisma.category.findMany).toHaveBeenCalledWith({
        where: { userId: testUserId },
      });
    });
  });

  describe('findOne', () => {
    it('should return a category if found', async () => {
      mockPrismaService.category.findFirst.mockResolvedValue(mockCategory);
      const result = await service.findOne('test-id', testUserId);
      expect(result).toEqual(mockCategory);
    });

    it('should throw NotFoundException if not found', async () => {
      mockPrismaService.category.findFirst.mockResolvedValue(null);
      await expect(service.findOne('test-id', testUserId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update and return a category', async () => {
      mockPrismaService.category.findFirst.mockResolvedValue(mockCategory);
      mockPrismaService.category.update.mockResolvedValue({
        ...mockCategory,
        name: 'updated',
      });
      const result = await service.update(
        'test-id',
        { name: 'updated' },
        testUserId,
      );
      expect(result.name).toBe('updated');
    });

    it('should throw NotFoundException if not found', async () => {
      mockPrismaService.category.findFirst.mockResolvedValue(null);
      await expect(
        service.update('test-id', { name: 'updated' }, testUserId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should delete and return a category', async () => {
      mockPrismaService.category.findFirst.mockResolvedValue(mockCategory);
      mockPrismaService.category.delete.mockResolvedValue(mockCategory);
      const result = await service.remove('test-id', testUserId);
      expect(result).toEqual(mockCategory);
    });

    it('should throw NotFoundException if not found', async () => {
      mockPrismaService.category.findFirst.mockResolvedValue(null);
      await expect(service.remove('test-id', testUserId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
