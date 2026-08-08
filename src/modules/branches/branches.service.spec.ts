import { Test, TestingModule } from '@nestjs/testing';
import { BranchesService } from './branches.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';
import { Branch } from '@prisma/client';

describe('BranchesService', () => {
  let service: BranchesService;
  let prisma: PrismaService;

  const mockBranch: Branch = {
    id: 'test-id',
    name: 'test-branch',
  };

  const mockPrismaService = {
    branch: {
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
        BranchesService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<BranchesService>(BranchesService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a branch', async () => {
      mockPrismaService.branch.create.mockResolvedValue(mockBranch);
      const result = await service.create({ name: 'test-branch' });
      expect(result).toEqual(mockBranch);
      expect(
        (prisma.branch.create as jest.Mock).mock.calls.length,
      ).toBeGreaterThan(0);
    });
  });

  describe('findAll', () => {
    it('should return an array of branches', async () => {
      mockPrismaService.branch.findMany.mockResolvedValue([mockBranch]);
      const result = await service.findAll();
      expect(result).toEqual([mockBranch]);
      expect(
        (prisma.branch.findMany as jest.Mock).mock.calls.length,
      ).toBeGreaterThan(0);
    });
  });

  describe('findOne', () => {
    it('should return a branch if found', async () => {
      mockPrismaService.branch.findUnique.mockResolvedValue(mockBranch);
      const result = await service.findOne('test-id');
      expect(result).toEqual(mockBranch);
      expect(
        (prisma.branch.findUnique as jest.Mock).mock.calls.length,
      ).toBeGreaterThan(0);
    });

    it('should throw NotFoundException if not found', async () => {
      mockPrismaService.branch.findUnique.mockResolvedValue(null);
      await expect(service.findOne('test-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update and return a branch', async () => {
      mockPrismaService.branch.findUnique.mockResolvedValue(mockBranch);
      mockPrismaService.branch.update.mockResolvedValue({
        ...mockBranch,
        name: 'updated',
      });
      const result = await service.update('test-id', { name: 'updated' });
      expect(result.name).toBe('updated');
      expect(
        (prisma.branch.update as jest.Mock).mock.calls.length,
      ).toBeGreaterThan(0);
    });

    it('should throw NotFoundException if branch to update is not found', async () => {
      mockPrismaService.branch.findUnique.mockResolvedValue(null);
      await expect(
        service.update('test-id', { name: 'updated' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should delete and return a branch', async () => {
      mockPrismaService.branch.findUnique.mockResolvedValue(mockBranch);
      mockPrismaService.branch.delete.mockResolvedValue(mockBranch);
      const result = await service.remove('test-id');
      expect(result).toEqual(mockBranch);
      expect(
        (prisma.branch.delete as jest.Mock).mock.calls.length,
      ).toBeGreaterThan(0);
    });

    it('should throw NotFoundException if branch to delete is not found', async () => {
      mockPrismaService.branch.findUnique.mockResolvedValue(null);
      await expect(service.remove('test-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
