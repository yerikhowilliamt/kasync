import { Test, TestingModule } from '@nestjs/testing';
import { LedgerEntriesService } from './ledger-entries.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';
import { Prisma, TransactionType } from '@prisma/client';

import { CreateLedgerEntryDto } from './dto/create-ledger-entry.dto';
import { UpdateLedgerEntryDto } from './dto/update-ledger-entry.dto';

describe('LedgerEntriesService', () => {
  let service: LedgerEntriesService;
  // let _prisma: PrismaService;

  const mockPrisma = {
    ledgerEntry: {
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
        LedgerEntriesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<LedgerEntriesService>(LedgerEntriesService);
    // _prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a ledger entry', async () => {
      const dto = {
        categoryId: 'cat1',
        branchId: 'branch1',
        entryDate: '2023-10-10T00:00:00Z',
        amount: 100,
        type: TransactionType.OUTFLOW,
        note: 'test',
      } as unknown as CreateLedgerEntryDto;
      mockPrisma.ledgerEntry.create.mockResolvedValue({ id: '1', ...dto });

      const result = await service.create(dto);
      expect((result as { id: string }).id).toEqual('1');
      expect(mockPrisma.ledgerEntry.create).toHaveBeenCalledWith({
        data: {
          categoryId: dto.categoryId,
          branchId: dto.branchId,
          entryDate: new Date(dto.entryDate),
          amount: expect.anything() as unknown,
          type: dto.type,
          note: dto.note,
        },
        include: { category: true, branch: true },
      });
    });

    it('should throw NotFoundException if category or branch not found', async () => {
      const dto = {
        categoryId: 'cat1',
        branchId: 'branch1',
        entryDate: '2023-10-10T00:00:00Z',
        amount: 100,
        type: TransactionType.OUTFLOW,
      } as unknown as CreateLedgerEntryDto;
      const error = new Prisma.PrismaClientKnownRequestError(
        'Foreign key failed',
        { code: 'P2003', clientVersion: '4' },
      );
      mockPrisma.ledgerEntry.create.mockRejectedValue(error);

      await expect(service.create(dto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findOne', () => {
    it('should return a ledger entry', async () => {
      mockPrisma.ledgerEntry.findUnique.mockResolvedValue({ id: '1' });
      const result = await service.findOne('1');
      expect(result).toEqual({ id: '1' });
    });

    it('should throw NotFoundException if not found', async () => {
      mockPrisma.ledgerEntry.findUnique.mockResolvedValue(null);
      await expect(service.findOne('1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update a ledger entry', async () => {
      mockPrisma.ledgerEntry.findUnique.mockResolvedValue({ id: '1' });
      mockPrisma.ledgerEntry.update.mockResolvedValue({
        id: '1',
        amount: new Prisma.Decimal(200),
      });

      const updateDto = { amount: 200 } as unknown as UpdateLedgerEntryDto;
      const result = await service.update('1', updateDto);
      expect(
        (result as { amount: { toString: () => string } }).amount.toString(),
      ).toBe('200');
      expect(mockPrisma.ledgerEntry.update).toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should delete a ledger entry', async () => {
      mockPrisma.ledgerEntry.findUnique.mockResolvedValue({ id: '1' });
      mockPrisma.ledgerEntry.delete.mockResolvedValue({ id: '1' });

      await service.remove('1');
      expect(mockPrisma.ledgerEntry.delete).toHaveBeenCalledWith({
        where: { id: '1' },
      });
    });
  });
});
