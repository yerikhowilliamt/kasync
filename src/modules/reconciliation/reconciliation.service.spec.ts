import { Test, TestingModule } from '@nestjs/testing';
import { ReconciliationService } from './reconciliation.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TransactionStatus, TransactionType } from '@prisma/client';
import Decimal from 'decimal.js';

describe('ReconciliationService', () => {
  const TEST_USER_ID = 'test-user-id';

  let service: ReconciliationService;

  const mockPrismaService = {
    bankTransaction: {
      groupBy: jest.fn(),
      aggregate: jest.fn(),
    },
    ledgerEntry: {
      aggregate: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReconciliationService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<ReconciliationService>(ReconciliationService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getDashboardSummary', () => {
    it('should calculate counts, actual bank balance, recorded ledger balance, and variance correctly', async () => {
      mockPrismaService.bankTransaction.groupBy.mockResolvedValue([
        { status: TransactionStatus.UNRESOLVED, _count: { _all: 2 } },
        { status: TransactionStatus.MATCHED, _count: { _all: 3 } },
      ]);

      mockPrismaService.bankTransaction.aggregate
        .mockResolvedValueOnce({ _sum: { amount: new Decimal('125.50') } }) // INFLOW
        .mockResolvedValueOnce({ _sum: { amount: new Decimal('50.00') } }); // OUTFLOW

      mockPrismaService.ledgerEntry.aggregate
        .mockResolvedValueOnce({ _sum: { amount: new Decimal('100.00') } }) // INFLOW
        .mockResolvedValueOnce({ _sum: { amount: new Decimal('20.00') } }); // OUTFLOW

      const result = await service.getDashboardSummary(TEST_USER_ID, {});

      expect(result.counts).toEqual({
        [TransactionStatus.UNRESOLVED]: 2,
        [TransactionStatus.PENDING_REVIEW]: 0,
        [TransactionStatus.PARTIALLY_ALLOCATED]: 0,
        [TransactionStatus.MATCHED]: 3,
      });

      // Bank balance: 125.50 - 50.00 = 75.50
      expect(result.actualBankBalance).toBe('75.50');
      // Ledger balance: 100.00 - 20.00 = 80.00
      expect(result.recordedLedgerBalance).toBe('80.00');
      // Variance: 75.50 - 80.00 = -4.50
      expect(result.variance).toBe('-4.50');
    });

    it('should pass filters to Prisma queries correctly', async () => {
      mockPrismaService.bankTransaction.groupBy.mockResolvedValue([]);
      mockPrismaService.bankTransaction.aggregate.mockResolvedValue({
        _sum: { amount: null },
      });
      mockPrismaService.ledgerEntry.aggregate.mockResolvedValue({
        _sum: { amount: null },
      });

      const query = {
        accountId: 'acc-1',
        categoryId: 'cat-1',
        branchId: 'br-1',
        startDate: '2026-01-01T00:00:00.000Z',
        endDate: '2026-01-31T23:59:59.999Z',
        type: TransactionType.INFLOW,
        status: TransactionStatus.MATCHED,
      };

      await service.getDashboardSummary(TEST_USER_ID, query);

      const expectedWhere: Record<string, unknown> = {
        accountId: 'acc-1',
        type: TransactionType.INFLOW,
        status: TransactionStatus.MATCHED,
        txnDate: {
          gte: new Date(query.startDate),
          lte: new Date(query.endDate),
        },
        allocations: {
          some: {
            status: 'ACTIVE',
            ledgerEntry: {
              categoryId: 'cat-1',
              branchId: 'br-1',
            },
          },
        },
      };

      expect(mockPrismaService.bankTransaction.groupBy).toHaveBeenCalledWith({
        by: ['status'],
        where: expect.objectContaining(expectedWhere) as Record<
          string,
          unknown
        >,
        _count: { _all: true },
      });

      const expectedLedgerWhere: Record<string, unknown> = {
        type: TransactionType.INFLOW,
        categoryId: 'cat-1',
        branchId: 'br-1',
        entryDate: {
          gte: new Date(query.startDate),
          lte: new Date(query.endDate),
        },
      };

      expect(mockPrismaService.ledgerEntry.aggregate).toHaveBeenCalledWith({
        where: expect.objectContaining(expectedLedgerWhere) as Record<
          string,
          unknown
        >,
        _sum: {
          amount: true,
        },
      });
    });
  });
});
