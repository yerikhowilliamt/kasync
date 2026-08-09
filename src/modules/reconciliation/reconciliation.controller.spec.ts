import { Test, TestingModule } from '@nestjs/testing';
import { ReconciliationController } from './reconciliation.controller';
import { ReconciliationService } from './reconciliation.service';
import { TransactionStatus } from '@prisma/client';

describe('ReconciliationController', () => {
  const TEST_USER_ID = 'test-user-id';

  let controller: ReconciliationController;

  const mockReconciliationService = {
    getDashboardSummary: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReconciliationController],
      providers: [
        {
          provide: ReconciliationService,
          useValue: mockReconciliationService,
        },
      ],
    }).compile();

    controller = module.get<ReconciliationController>(ReconciliationController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getDashboardSummary', () => {
    it('should return dashboard summary from service', async () => {
      const summaryMock = {
        counts: {
          [TransactionStatus.UNRESOLVED]: 1,
          [TransactionStatus.PENDING_REVIEW]: 0,
          [TransactionStatus.PARTIALLY_ALLOCATED]: 1,
          [TransactionStatus.MATCHED]: 2,
        },
        actualBankBalance: '100.00',
        recordedLedgerBalance: '100.00',
        variance: '0.00',
      };

      mockReconciliationService.getDashboardSummary.mockResolvedValue(
        summaryMock,
      );

      const query = { accountId: 'acc-1' };
      const result = await controller.getDashboardSummary(TEST_USER_ID, query);

      expect(result).toEqual(summaryMock);
      expect(
        mockReconciliationService.getDashboardSummary,
      ).toHaveBeenCalledWith(TEST_USER_ID, query);
    });
  });
});
