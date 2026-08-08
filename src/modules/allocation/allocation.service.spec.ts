import { Test, TestingModule } from '@nestjs/testing';
import { AllocationService } from './allocation.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { AllocationExceededError } from '../../common/errors/allocation-exceeded.error';
import { AllocationStatus } from '@prisma/client';
import Decimal from 'decimal.js';

describe('AllocationService', () => {
  let service: AllocationService;
  let prismaService: PrismaService; // eslint-disable-line @typescript-eslint/no-unused-vars

  type MockPrismaService = {
    $transaction: jest.Mock;
    bankTransaction: {
      findUnique: jest.Mock;
    };
    ledgerEntry: {
      findUnique: jest.Mock;
    };
    allocation: {
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      findMany: jest.Mock;
    };
  };

  function createMockPrismaService(): MockPrismaService {
    const mock: MockPrismaService = {
      $transaction: jest.fn((callback: (arg: MockPrismaService) => unknown) =>
        callback(mock),
      ) as jest.Mock,
      bankTransaction: {
        findUnique: jest.fn(),
      },
      ledgerEntry: {
        findUnique: jest.fn(),
      },
      allocation: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
    };
    return mock;
  }

  let mockPrismaService: MockPrismaService;

  beforeEach(async () => {
    mockPrismaService = createMockPrismaService();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AllocationService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<AllocationService>(AllocationService);
    prismaService = mockPrismaService as unknown as PrismaService;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should throw BadRequestException if no allocations provided', async () => {
      await expect(service.create({})).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if BankTransaction not found', async () => {
      mockPrismaService.bankTransaction.findUnique.mockResolvedValue(
        null as any,
      );

      await expect(
        service.create({
          bankTransactionId: 'txn-1',
          ledgerEntryId: 'entry-1',
          amountPortion: 100,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if ledgerEntryId not found', async () => {
      mockPrismaService.bankTransaction.findUnique.mockResolvedValue({
        id: 'txn-1',
        amount: new Decimal(200),
        allocations: [],
      } as any);
      mockPrismaService.ledgerEntry.findUnique.mockResolvedValue(null as any);

      await expect(
        service.create({
          bankTransactionId: 'txn-1',
          ledgerEntryId: 'entry-1',
          amountPortion: 100,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw AllocationExceededError if sum exceeds transaction amount', async () => {
      mockPrismaService.bankTransaction.findUnique.mockResolvedValue({
        id: 'txn-1',
        amount: new Decimal(150),
        allocations: [{ amountPortion: new Decimal(100), status: 'ACTIVE' }],
      } as any);

      await expect(
        service.create({
          bankTransactionId: 'txn-1',
          ledgerEntryId: 'entry-1',
          amountPortion: 100,
        }),
      ).rejects.toThrow(AllocationExceededError);
    });

    it('should create single allocation successfully', async () => {
      mockPrismaService.bankTransaction.findUnique.mockResolvedValue({
        id: 'txn-1',
        amount: new Decimal(200),
        allocations: [],
      } as any);
      mockPrismaService.ledgerEntry.findUnique.mockResolvedValue({
        id: 'entry-1',
      } as any);
      mockPrismaService.allocation.create.mockResolvedValue({
        id: 'alloc-1',
        amountPortion: new Decimal(100),
        status: 'ACTIVE',
      } as any);

      const result = await service.create({
        bankTransactionId: 'txn-1',
        ledgerEntryId: 'entry-1',
        amountPortion: 100,
      });

      expect(result).toHaveLength(1);
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
      mockPrismaService.bankTransaction.findUnique.mockResolvedValue({
        id: 'txn-1',
        amount: new Decimal(200),
        allocations: [],
      } as any);
      mockPrismaService.ledgerEntry.findUnique.mockResolvedValue({
        id: 'entry-1',
      } as any);
      mockPrismaService.allocation.create
        .mockResolvedValueOnce({
          id: 'alloc-1',
          amountPortion: new Decimal(100),
          status: 'ACTIVE',
        } as any)
        .mockResolvedValueOnce({
          id: 'alloc-2',
          amountPortion: new Decimal(50),
          status: 'ACTIVE',
        } as any);

      const result = await service.create({
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
      expect(mockPrismaService.allocation.create).toHaveBeenCalledTimes(2);
    });
  });

  describe('revoke', () => {
    it('should throw NotFoundException if allocation not found', async () => {
      mockPrismaService.allocation.findUnique.mockResolvedValue(null as any);

      await expect(service.revoke('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should revoke allocation successfully', async () => {
      mockPrismaService.allocation.findUnique.mockResolvedValue({
        id: 'alloc-1',
      } as any);
      mockPrismaService.allocation.update.mockResolvedValue({
        id: 'alloc-1',
        status: AllocationStatus.REVOKED,
      } as any);

      const result = await service.revoke('alloc-1');

      expect(result.status).toBe(AllocationStatus.REVOKED);
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
      const expected = [{ id: 'alloc-1' }];
      mockPrismaService.allocation.findMany.mockResolvedValue(expected);

      const result = await service.findByTransaction('txn-1');

      expect(result).toBe(expected);
      expect(mockPrismaService.allocation.findMany).toHaveBeenCalledWith({
        where: { bankTransactionId: 'txn-1' },
        include: { ledgerEntry: true },
      });
    });
  });

  describe('findByLedgerEntry', () => {
    it('should return allocations by ledger entry id', async () => {
      const expected = [{ id: 'alloc-1' }];
      mockPrismaService.allocation.findMany.mockResolvedValue(expected);

      const result = await service.findByLedgerEntry('entry-1');

      expect(result).toBe(expected);
      expect(mockPrismaService.allocation.findMany).toHaveBeenCalledWith({
        where: { ledgerEntryId: 'entry-1' },
        include: { bankTransaction: true },
      });
    });
  });
});
