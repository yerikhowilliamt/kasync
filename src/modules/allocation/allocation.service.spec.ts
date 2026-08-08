import { Test, TestingModule } from '@nestjs/testing';
import { AllocationService } from './allocation.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';
import { AllocationExceededError } from '../../common/errors/allocation-exceeded.error';
import { AllocationStatus } from '@prisma/client';
import Decimal from 'decimal.js';

describe('AllocationService', () => {
  let service: AllocationService;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let prismaService: PrismaService;

  const mockPrismaService: any = {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
    $transaction: jest.fn((callback: any) => callback(mockPrismaService)),
    bankTransaction: {
      findUnique: jest.fn(),
    },
    allocation: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AllocationService,
        {
          provide: PrismaService,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<AllocationService>(AllocationService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should throw error if no allocations provided', async () => {
      await expect(service.create({})).rejects.toThrow(
        'No allocations provided',
      );
    });

    it('should throw NotFoundException if BankTransaction not found', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      mockPrismaService.bankTransaction.findUnique.mockResolvedValue(null);

      await expect(
        service.create({
          bankTransactionId: 'txn-1',
          ledgerEntryId: 'entry-1',
          amountPortion: 100,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw AllocationExceededError if sum exceeds transaction amount', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      mockPrismaService.bankTransaction.findUnique.mockResolvedValue({
        id: 'txn-1',
        amount: new Decimal(150),
        allocations: [{ amountPortion: new Decimal(100), status: 'ACTIVE' }],
      });

      await expect(
        service.create({
          bankTransactionId: 'txn-1',
          ledgerEntryId: 'entry-1',
          amountPortion: 100,
        }),
      ).rejects.toThrow(AllocationExceededError);
    });

    it('should create single allocation successfully', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      mockPrismaService.bankTransaction.findUnique.mockResolvedValue({
        id: 'txn-1',
        amount: new Decimal(200),
        allocations: [],
      });
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      mockPrismaService.allocation.create.mockResolvedValue({
        id: 'alloc-1',
        amountPortion: new Decimal(100),
        status: 'ACTIVE',
      });

      const result: any = await service.create({
        bankTransactionId: 'txn-1',
        ledgerEntryId: 'entry-1',
        amountPortion: 100,
      });

      expect(result).toHaveLength(1);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(mockPrismaService.allocation.create).toHaveBeenCalledWith({
        data: {
          bankTransactionId: 'txn-1',
          ledgerEntryId: 'entry-1',
          amountPortion: '100',
          status: AllocationStatus.ACTIVE,
        },
      });
    });

    it('should create split allocation successfully', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      mockPrismaService.bankTransaction.findUnique.mockResolvedValue({
        id: 'txn-1',
        amount: new Decimal(200),
        allocations: [],
      });
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      mockPrismaService.allocation.create
        .mockResolvedValueOnce({
          id: 'alloc-1',
          amountPortion: new Decimal(100),
          status: 'ACTIVE',
        })
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        .mockResolvedValueOnce({
          id: 'alloc-2',
          amountPortion: new Decimal(50),
          status: 'ACTIVE',
        });

      const result: any = await service.create({
        allocations: [
          {
            bankTransactionId: 'txn-1',
            ledgerEntryId: 'entry-1',
            amountPortion: 100,
          },
          {
            bankTransactionId: 'txn-1',
            ledgerEntryId: 'entry-2',
            amountPortion: 50,
          },
        ],
      });

      expect(result).toHaveLength(2);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(mockPrismaService.allocation.create).toHaveBeenCalledTimes(2);
    });
  });

  describe('revoke', () => {
    it('should throw NotFoundException if allocation not found', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      mockPrismaService.allocation.findUnique.mockResolvedValue(null);

      await expect(service.revoke('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should revoke allocation successfully', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      mockPrismaService.allocation.findUnique.mockResolvedValue({
        id: 'alloc-1',
      });
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      mockPrismaService.allocation.update.mockResolvedValue({
        id: 'alloc-1',
        status: AllocationStatus.REVOKED,
      });

      const result: any = await service.revoke('alloc-1');

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(result.status).toBe(AllocationStatus.REVOKED);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(mockPrismaService.allocation.update).toHaveBeenCalledWith({
        where: { id: 'alloc-1' },
        data: {
          status: AllocationStatus.REVOKED,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          revokedAt: expect.any(Date),
        },
      });
    });
  });

  describe('findByTransaction', () => {
    it('should return allocations by transaction id', async () => {
      const expected: any = [{ id: 'alloc-1' }];
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      mockPrismaService.allocation.findMany.mockResolvedValue(expected);

      const result: any = await service.findByTransaction('txn-1');

      expect(result).toBe(expected);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(mockPrismaService.allocation.findMany).toHaveBeenCalledWith({
        where: { bankTransactionId: 'txn-1' },
        include: { ledgerEntry: true },
      });
    });
  });

  describe('findByLedgerEntry', () => {
    it('should return allocations by ledger entry id', async () => {
      const expected: any = [{ id: 'alloc-1' }];
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      mockPrismaService.allocation.findMany.mockResolvedValue(expected);

      const result: any = await service.findByLedgerEntry('entry-1');

      expect(result).toBe(expected);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(mockPrismaService.allocation.findMany).toHaveBeenCalledWith({
        where: { ledgerEntryId: 'entry-1' },
        include: { bankTransaction: true },
      });
    });
  });
});
