import { Test, TestingModule } from '@nestjs/testing';
import { LedgerEntriesService } from './ledger-entries.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';
import { Prisma, TransactionType } from '@prisma/client';
import { CreateLedgerEntryDto } from './dto/create-ledger-entry.dto';
import { UpdateLedgerEntryDto } from './dto/update-ledger-entry.dto';

describe('LedgerEntriesService', () => {
  let service: LedgerEntriesService;
  const testUserId = 'user-123';

  const mockPrisma = {
    ledgerEntry: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    category: { findFirst: jest.fn() },
    branch: { findFirst: jest.fn() },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LedgerEntriesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<LedgerEntriesService>(LedgerEntriesService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => expect(service).toBeDefined());

  describe('create', () => {
    it('should create a ledger entry', async () => {
      mockPrisma.category.findFirst.mockResolvedValue({ id: 'cat1', name: 'Cat' });
      mockPrisma.branch.findFirst.mockResolvedValue({ id: 'branch1', name: 'Br' });
      mockPrisma.ledgerEntry.create.mockResolvedValue({ id: '1' });

      const dto = {
        categoryId: 'cat1', branchId: 'branch1', entryDate: '2023-10-10T00:00:00Z',
        amount: 100, type: TransactionType.OUTFLOW, note: 'test',
      } as unknown as CreateLedgerEntryDto;

      const result = await service.create(dto, testUserId);
      expect((result as any).id).toEqual('1');
      expect(mockPrisma.ledgerEntry.create).toHaveBeenCalledWith({
        data: {
          user: { connect: { id: testUserId } },
          category: { connect: { id: 'cat1' } },
          branch: { connect: { id: 'branch1' } },
          entryDate: new Date('2023-10-10T00:00:00Z'),
          amount: expect.anything(), type: TransactionType.OUTFLOW, note: 'test',
        },
        include: { category: true, branch: true },
      });
    });

    it('should throw NotFoundException if category not found', async () => {
      mockPrisma.category.findFirst.mockResolvedValue(null);
      const dto = {
        categoryId: 'cat1', branchId: 'branch1', entryDate: '2023-10-10T00:00:00Z',
        amount: 100, type: TransactionType.OUTFLOW,
      } as unknown as CreateLedgerEntryDto;
      await expect(service.create(dto, testUserId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('should return paginated ledger entries for user', async () => {
      mockPrisma.ledgerEntry.findMany.mockResolvedValue([{ id: '1' }]);
      mockPrisma.ledgerEntry.count.mockResolvedValue(1);
      const result = await service.findAll(testUserId, { page: 1, limit: 10 });
      expect(result.data).toEqual([{ id: '1' }]);
      expect(result.meta.total).toBe(1);
      expect(mockPrisma.ledgerEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: testUserId } }),
      );
    });
  });

  describe('findOne', () => {
    it('should return a ledger entry', async () => {
      mockPrisma.ledgerEntry.findFirst.mockResolvedValue({ id: '1' });
      const result = await service.findOne('1', testUserId);
      expect(result).toEqual({ id: '1' });
      expect(mockPrisma.ledgerEntry.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: '1', userId: testUserId } }),
      );
    });

    it('should throw NotFoundException if not found', async () => {
      mockPrisma.ledgerEntry.findFirst.mockResolvedValue(null);
      await expect(service.findOne('1', testUserId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update a ledger entry', async () => {
      mockPrisma.ledgerEntry.findFirst.mockResolvedValue({ id: '1' });
      mockPrisma.ledgerEntry.update.mockResolvedValue({ id: '1', amount: new Prisma.Decimal(200) });
      const updateDto = { amount: 200 } as unknown as UpdateLedgerEntryDto;
      const result = await service.update('1', updateDto, testUserId);
      expect((result as any).amount.toString()).toBe('200');
      expect(mockPrisma.ledgerEntry.update).toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should delete a ledger entry', async () => {
      mockPrisma.ledgerEntry.findFirst.mockResolvedValue({ id: '1' });
      mockPrisma.ledgerEntry.delete.mockResolvedValue({ id: '1' });
      await service.remove('1', testUserId);
      expect(mockPrisma.ledgerEntry.delete).toHaveBeenCalledWith({ where: { id: '1' } });
    });
  });
});
