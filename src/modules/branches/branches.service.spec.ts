import { Test, TestingModule } from '@nestjs/testing';
import { BranchesService } from './branches.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('BranchesService', () => {
  let service: BranchesService;
  let prisma: PrismaService;
  const testUserId = 'user-123';

  const mockBranch = {
    id: 'test-id',
    name: 'test-branch',
    userId: testUserId,
    ledgerEntries: [],
  };

  const mockPrismaService = {
    branch: {
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
        BranchesService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<BranchesService>(BranchesService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => expect(service).toBeDefined());

  describe('create', () => {
    it('should create a branch', async () => {
      mockPrismaService.branch.create.mockResolvedValue(mockBranch);
      const result = await service.create({ name: 'test-branch' }, testUserId);
      expect(result).toEqual(mockBranch);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(prisma.branch.create).toHaveBeenCalledWith({
        data: { name: 'test-branch', user: { connect: { id: testUserId } } },
      });
    });
  });

  describe('findAll', () => {
    it('should return branches for a user', async () => {
      mockPrismaService.branch.findMany.mockResolvedValue([mockBranch]);
      const result = await service.findAll(testUserId);
      expect(result).toEqual([mockBranch]);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(prisma.branch.findMany).toHaveBeenCalledWith({
        where: { userId: testUserId },
      });
    });
  });

  describe('findOne', () => {
    it('should return a branch if found', async () => {
      mockPrismaService.branch.findFirst.mockResolvedValue(mockBranch);
      const result = await service.findOne('test-id', testUserId);
      expect(result).toEqual(mockBranch);
    });

    it('should throw NotFoundException if not found', async () => {
      mockPrismaService.branch.findFirst.mockResolvedValue(null);
      await expect(service.findOne('test-id', testUserId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update and return a branch', async () => {
      mockPrismaService.branch.findFirst.mockResolvedValue(mockBranch);
      mockPrismaService.branch.update.mockResolvedValue({
        ...mockBranch,
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
      mockPrismaService.branch.findFirst.mockResolvedValue(null);
      await expect(
        service.update('test-id', { name: 'updated' }, testUserId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should delete and return a branch', async () => {
      mockPrismaService.branch.findFirst.mockResolvedValue(mockBranch);
      mockPrismaService.branch.delete.mockResolvedValue(mockBranch);
      const result = await service.remove('test-id', testUserId);
      expect(result).toEqual(mockBranch);
    });

    it('should throw NotFoundException if not found', async () => {
      mockPrismaService.branch.findFirst.mockResolvedValue(null);
      await expect(service.remove('test-id', testUserId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
