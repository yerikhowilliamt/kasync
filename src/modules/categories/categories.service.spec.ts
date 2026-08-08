import { Test, TestingModule } from '@nestjs/testing';
import { CategoriesService } from './categories.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';
import { Category } from '@prisma/client';

describe('CategoriesService', () => {
  let service: CategoriesService;
  let prisma: PrismaService;

  const mockCategory: Category = {
    id: 'test-id',
    name: 'test-category',
  };

  const mockPrismaService = {
    category: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
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

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a category', async () => {
      mockPrismaService.category.create.mockResolvedValue(mockCategory);
      const result = await service.create({ name: 'test-category' });
      expect(result).toEqual(mockCategory);
      expect(prisma.category.create).toHaveBeenCalledWith({
        data: { name: 'test-category' },
      });
    });
  });

  describe('findAll', () => {
    it('should return an array of categories', async () => {
      mockPrismaService.category.findMany.mockResolvedValue([mockCategory]);
      const result = await service.findAll();
      expect(result).toEqual([mockCategory]);
      expect(prisma.category.findMany).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return a category if found', async () => {
      mockPrismaService.category.findUnique.mockResolvedValue(mockCategory);
      const result = await service.findOne('test-id');
      expect(result).toEqual(mockCategory);
      expect(prisma.category.findUnique).toHaveBeenCalledWith({
        where: { id: 'test-id' },
      });
    });

    it('should throw NotFoundException if not found', async () => {
      mockPrismaService.category.findUnique.mockResolvedValue(null);
      await expect(service.findOne('test-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update and return a category', async () => {
      mockPrismaService.category.findUnique.mockResolvedValue(mockCategory);
      mockPrismaService.category.update.mockResolvedValue({
        ...mockCategory,
        name: 'updated',
      });
      const result = await service.update('test-id', { name: 'updated' });
      expect(result.name).toBe('updated');
      expect(prisma.category.update).toHaveBeenCalledWith({
        where: { id: 'test-id' },
        data: { name: 'updated' },
      });
    });

    it('should throw NotFoundException if category to update is not found', async () => {
      mockPrismaService.category.findUnique.mockResolvedValue(null);
      await expect(
        service.update('test-id', { name: 'updated' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should delete and return a category', async () => {
      mockPrismaService.category.findUnique.mockResolvedValue(mockCategory);
      mockPrismaService.category.delete.mockResolvedValue(mockCategory);
      const result = await service.remove('test-id');
      expect(result).toEqual(mockCategory);
      expect(prisma.category.delete).toHaveBeenCalledWith({
        where: { id: 'test-id' },
      });
    });

    it('should throw NotFoundException if category to delete is not found', async () => {
      mockPrismaService.category.findUnique.mockResolvedValue(null);
      await expect(service.remove('test-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
