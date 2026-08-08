import { Test, TestingModule } from '@nestjs/testing';
import { MatchingService } from './matching.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TransactionStatus, TransactionType } from '@prisma/client';
import { ProposeMatchesDto } from './dto/propose-matches.dto';
import { Decimal } from 'decimal.js';

describe('MatchingService', () => {
  let service: MatchingService;
  // let _prismaService: PrismaService;

  const mockPrismaService = {
    bankTransaction: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    ledgerEntry: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MatchingService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<MatchingService>(MatchingService);
    // _prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('proposeMatches', () => {
    it('should query UNRESOLVED bank transactions, ledger entries, call engine, and update status', async () => {
      const bankTxnId = 'txn-1';
      const ledgerEntryId = 'le-1';

      mockPrismaService.bankTransaction.findMany.mockResolvedValue([
        {
          id: bankTxnId,
          amount: new Decimal(100),
          txnDate: new Date('2024-01-01'),
          description: 'Test Txn',
          status: TransactionStatus.UNRESOLVED,
          type: TransactionType.OUTFLOW,
          accountId: 'acc-1',
          externalRef: null,
          dedupHash: null,
          importedAt: new Date(),
        },
      ]);

      mockPrismaService.ledgerEntry.findMany.mockResolvedValue([
        {
          id: ledgerEntryId,
          amount: new Decimal(100),
          entryDate: new Date('2024-01-01'),
          note: 'Test LE',
          type: TransactionType.OUTFLOW,
          categoryId: 'cat-1',
          branchId: 'branch-1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      mockPrismaService.bankTransaction.updateMany.mockResolvedValue({
        count: 1,
      });

      const dto: ProposeMatchesDto = {
        accountId: 'acc-1',
        dateToleranceDays: 2,
      };
      const candidates = await service.proposeMatches(dto);

      expect(mockPrismaService.bankTransaction.findMany).toHaveBeenCalledWith({
        where: { status: TransactionStatus.UNRESOLVED, accountId: 'acc-1' },
      });
      expect(mockPrismaService.ledgerEntry.findMany).toHaveBeenCalled();

      expect(candidates.length).toBeGreaterThan(0);
      expect(candidates[0].bankTransactionIds).toContain(bankTxnId);
      expect(candidates[0].ledgerEntryId).toEqual(ledgerEntryId);

      expect(mockPrismaService.bankTransaction.updateMany).toHaveBeenCalledWith(
        {
          where: { id: { in: [bankTxnId] } },
          data: { status: TransactionStatus.PENDING_REVIEW },
        },
      );
    });

    it('should not update anything if no matches found', async () => {
      mockPrismaService.bankTransaction.findMany.mockResolvedValue([]);
      mockPrismaService.ledgerEntry.findMany.mockResolvedValue([]);

      const candidates = await service.proposeMatches();

      expect(candidates.length).toBe(0);
      expect(
        mockPrismaService.bankTransaction.updateMany,
      ).not.toHaveBeenCalled();
    });
  });
});
