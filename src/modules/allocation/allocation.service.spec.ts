import { Test, TestingModule } from '@nestjs/testing';
import { AllocationService } from './allocation.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { AllocationExceededError } from '../../common/errors/allocation-exceeded.error';
import { AllocationStatus } from '@prisma/client';
import Decimal from 'decimal.js';

describe('AllocationService', () => {
  const TEST_USER_ID = 'test-user-id';

  let service: AllocationService;
  let prismaService: PrismaService; // eslint-disable-line @typescript-eslint/no-unused-vars

  type MockPrismaService = {
    $transaction: jest.Mock;
    $queryRaw: jest.Mock;
    bankTransaction: {
      findFirst: jest.Mock;
    };
    ledgerEntry: {
      findFirst: jest.Mock;
    };
    allocation: {
      create: jest.Mock;
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
      findMany: jest.Mock;
    };
  };

  function createMockPrismaService(): MockPrismaService {
    const mock: MockPrismaService = {
      $transaction: jest.fn((callback: (arg: MockPrismaService) => unknown) =>
        callback(mock),
      ) as jest.Mock,
      $queryRaw: jest.fn().mockResolvedValue([]),
      bankTransaction: {
        findFirst: jest.fn(),
      },
      ledgerEntry: {
        findFirst: jest.fn(),
      },
      allocation: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
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
      await expect(service.create({}, TEST_USER_ID)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException if BankTransaction not found', async () => {
      mockPrismaService.bankTransaction.findFirst.mockResolvedValue(null);

      await expect(
        service.create(
          {
            bankTransactionId: 'txn-1',
            ledgerEntryId: 'entry-1',
            amountPortion: 100,
          },
          TEST_USER_ID,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if ledgerEntryId not found', async () => {
      mockPrismaService.bankTransaction.findFirst.mockResolvedValue({
        id: 'txn-1',
        amount: new Decimal(200),
        allocations: [],
      });
      mockPrismaService.ledgerEntry.findFirst.mockResolvedValue(null);

      await expect(
        service.create(
          {
            bankTransactionId: 'txn-1',
            ledgerEntryId: 'entry-1',
            amountPortion: 100,
          },
          TEST_USER_ID,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw AllocationExceededError if sum exceeds transaction amount', async () => {
      mockPrismaService.bankTransaction.findFirst.mockResolvedValue({
        id: 'txn-1',
        amount: new Decimal(150),
        allocations: [{ amountPortion: new Decimal(100), status: 'ACTIVE' }],
      });

      await expect(
        service.create(
          {
            bankTransactionId: 'txn-1',
            ledgerEntryId: 'entry-1',
            amountPortion: 100,
          },
          TEST_USER_ID,
        ),
      ).rejects.toThrow(AllocationExceededError);
    });

    it('should create single allocation successfully', async () => {
      mockPrismaService.bankTransaction.findFirst.mockResolvedValue({
        id: 'txn-1',
        amount: new Decimal(200),
        allocations: [],
      });
      mockPrismaService.ledgerEntry.findFirst.mockResolvedValue({
        id: 'entry-1',
      });
      mockPrismaService.allocation.create.mockResolvedValue({
        id: 'alloc-1',
        amountPortion: new Decimal(100),
        status: 'ACTIVE',
      });

      const result = await service.create(
        {
          bankTransactionId: 'txn-1',
          ledgerEntryId: 'entry-1',
          amountPortion: 100,
        },
        TEST_USER_ID,
      );

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
      mockPrismaService.bankTransaction.findFirst.mockResolvedValue({
        id: 'txn-1',
        amount: new Decimal(200),
        allocations: [],
      });
      mockPrismaService.ledgerEntry.findFirst.mockResolvedValue({
        id: 'entry-1',
      });
      mockPrismaService.allocation.create
        .mockResolvedValueOnce({
          id: 'alloc-1',
          amountPortion: new Decimal(100),
          status: 'ACTIVE',
        })
        .mockResolvedValueOnce({
          id: 'alloc-2',
          amountPortion: new Decimal(50),
          status: 'ACTIVE',
        });

      const result = await service.create(
        {
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
        },
        TEST_USER_ID,
      );

      expect(result).toHaveLength(2);
      expect(mockPrismaService.allocation.create).toHaveBeenCalledTimes(2);
    });

    it('should return existing allocation when idempotencyKey matches', async () => {
      mockPrismaService.bankTransaction.findFirst.mockResolvedValue({
        id: 'txn-1',
        amount: new Decimal(500),
        allocations: [],
      });
      mockPrismaService.ledgerEntry.findFirst.mockResolvedValue({
        id: 'entry-1',
      });
      const existingAllocation = {
        id: 'existing-alloc-1',
        bankTransactionId: 'txn-1',
        ledgerEntryId: 'entry-1',
        amountPortion: new Decimal(100),
        status: 'ACTIVE',
        idempotencyKey: 'key-1',
      };
      mockPrismaService.allocation.findFirst.mockResolvedValue(
        existingAllocation,
      );

      const result = await service.create(
        {
          bankTransactionId: 'txn-1',
          ledgerEntryId: 'entry-1',
          amountPortion: 100,
          idempotencyKey: 'key-1',
        },
        TEST_USER_ID,
      );

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('existing-alloc-1');
      expect(mockPrismaService.allocation.findFirst).toHaveBeenCalled();
      expect(mockPrismaService.allocation.create).not.toHaveBeenCalled();
    });

    it('should not throw AllocationExceededError when idempotent item + new item fit within cap', async () => {
      mockPrismaService.bankTransaction.findFirst.mockResolvedValue({
        id: 'txn-1',
        amount: new Decimal(600),
        allocations: [],
      });
      const existingAllocation = {
        id: 'existing-alloc-k1',
        bankTransactionId: 'txn-1',
        ledgerEntryId: 'entry-1',
        amountPortion: new Decimal(300),
        status: 'ACTIVE',
        idempotencyKey: 'K1',
      };
      const newAllocation = {
        id: 'alloc-new-le2',
        bankTransactionId: 'txn-1',
        ledgerEntryId: 'entry-2',
        amountPortion: new Decimal(200),
        status: 'ACTIVE',
      };
      // First findFirst call: idempotency pre-resolve for K1 → existing
      // Second findFirst call: ledgerEntry ownership (no idempotency key for LE2 item)
      mockPrismaService.allocation.findFirst
        .mockResolvedValueOnce(existingAllocation) // K1 idempotency resolve
        .mockResolvedValueOnce(null); // LE2 — no existing idempotent alloc
      mockPrismaService.ledgerEntry.findFirst.mockResolvedValue({
        id: 'entry-2',
      });
      mockPrismaService.allocation.create.mockResolvedValue(newAllocation);

      const result = await service.create(
        {
          allocations: [
            {
              bankTransactionId: 'txn-1',
              ledgerEntryId: 'entry-1',
              amountPortion: 300,
              idempotencyKey: 'K1',
            },
            {
              bankTransactionId: 'txn-1',
              ledgerEntryId: 'entry-2',
              amountPortion: 200,
            },
          ],
        },
        TEST_USER_ID,
      );

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('existing-alloc-k1');
      expect(result[1].id).toBe('alloc-new-le2');
      expect(mockPrismaService.allocation.create).toHaveBeenCalledTimes(1);
    });

    it('should create allocation normally when no idempotencyKey provided', async () => {
      mockPrismaService.bankTransaction.findFirst.mockResolvedValue({
        id: 'txn-1',
        amount: new Decimal(500),
        allocations: [],
      });
      mockPrismaService.ledgerEntry.findFirst.mockResolvedValue({
        id: 'entry-1',
      });
      mockPrismaService.allocation.create.mockResolvedValue({
        id: 'alloc-new-1',
        amountPortion: new Decimal(100),
        status: 'ACTIVE',
      });

      const result = await service.create(
        {
          bankTransactionId: 'txn-1',
          ledgerEntryId: 'entry-1',
          amountPortion: 100,
        },
        TEST_USER_ID,
      );

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('alloc-new-1');
      expect(mockPrismaService.allocation.create).toHaveBeenCalled();
    });

    it('should forward top-level idempotencyKey to single allocation create', async () => {
      mockPrismaService.bankTransaction.findFirst.mockResolvedValue({
        id: 'txn-1',
        amount: new Decimal(500),
        allocations: [],
      });
      mockPrismaService.ledgerEntry.findFirst.mockResolvedValue({
        id: 'entry-1',
      });
      // idempotency pre-resolve: key not yet in DB → proceed to create
      mockPrismaService.allocation.findFirst.mockResolvedValue(null);
      mockPrismaService.allocation.create.mockResolvedValue({
        id: 'alloc-1',
        amountPortion: new Decimal(100),
        status: 'ACTIVE',
        idempotencyKey: 'top-level-key',
      });

      const result = await service.create(
        {
          bankTransactionId: 'txn-1',
          ledgerEntryId: 'entry-1',
          amountPortion: 100,
          idempotencyKey: 'top-level-key',
        },
        TEST_USER_ID,
      );

      expect(result).toHaveLength(1);
      expect(mockPrismaService.allocation.create).toHaveBeenCalledWith({
        data: {
          bankTransactionId: 'txn-1',
          ledgerEntryId: 'entry-1',
          amountPortion: '100',
          idempotencyKey: 'top-level-key',
          status: AllocationStatus.ACTIVE,
        },
      });
    });
  });

  describe('revoke', () => {
    it('should throw NotFoundException if allocation not found', async () => {
      mockPrismaService.allocation.findFirst.mockResolvedValue(null);

      await expect(
        service.revoke('non-existent', TEST_USER_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('should revoke allocation successfully', async () => {
      mockPrismaService.allocation.findFirst.mockResolvedValue({
        id: 'alloc-1',
      });
      mockPrismaService.allocation.update.mockResolvedValue({
        id: 'alloc-1',
        status: AllocationStatus.REVOKED,
      });

      const result = await service.revoke('alloc-1', TEST_USER_ID);

      expect(result.status).toBe(AllocationStatus.REVOKED);
      expect(mockPrismaService.allocation.update).toHaveBeenCalledWith({
        where: { id: 'alloc-1' },
        data: {
          status: AllocationStatus.REVOKED,
          revokedAt: expect.any(Date) as unknown,
        },
      });
    });
  });

  describe('findByTransaction', () => {
    it('should return allocations by transaction id', async () => {
      const expected = [{ id: 'alloc-1' }];
      mockPrismaService.allocation.findMany.mockResolvedValue(expected);

      const result = await service.findByTransaction('txn-1', TEST_USER_ID);

      expect(result).toBe(expected);
      expect(mockPrismaService.allocation.findMany).toHaveBeenCalledWith({
        where: {
          bankTransactionId: 'txn-1',
          bankTransaction: { account: { userId: TEST_USER_ID } },
        },
        include: { ledgerEntry: true },
      });
    });
  });

  describe('findByLedgerEntry', () => {
    it('should return allocations by ledger entry id', async () => {
      const expected = [{ id: 'alloc-1' }];
      mockPrismaService.allocation.findMany.mockResolvedValue(expected);

      const result = await service.findByLedgerEntry('entry-1', TEST_USER_ID);

      expect(result).toBe(expected);
      expect(mockPrismaService.allocation.findMany).toHaveBeenCalledWith({
        where: {
          ledgerEntryId: 'entry-1',
          ledgerEntry: { userId: TEST_USER_ID },
        },
        include: { bankTransaction: true },
      });
    });
  });
});
