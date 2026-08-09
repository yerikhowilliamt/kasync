import { Test, TestingModule } from '@nestjs/testing';
import { MatchingController } from './matching.controller';
import { MatchingService } from './matching.service';
import { ProposeMatchesDto } from './dto/propose-matches.dto';

import Decimal from 'decimal.js';

describe('MatchingController', () => {
  const TEST_USER_ID = 'test-user-id';

  let controller: MatchingController;
  let matchingService: MatchingService;

  const mockMatchingService = {
    proposeMatches: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MatchingController],
      providers: [
        {
          provide: MatchingService,
          useValue: mockMatchingService,
        },
      ],
    }).compile();

    controller = module.get<MatchingController>(MatchingController);
    matchingService = module.get<MatchingService>(MatchingService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('propose', () => {
    it('should call matchingService.proposeMatches and return the result', async () => {
      const dto: ProposeMatchesDto = { accountId: 'acc-1' };
      const expectedResult = [
        {
          matchType: 'EXACT',
          confidence: 1,
          bankTransactionIds: ['bt-1'],
          ledgerEntryId: 'le-1',
          matchedAmount: new Decimal(100),
          dateDifferenceDays: 0,
        },
      ];
      mockMatchingService.proposeMatches.mockResolvedValue(expectedResult);

      const result = await controller.propose(TEST_USER_ID, dto);

      expect(
        jest.spyOn(matchingService, 'proposeMatches'),
      ).toHaveBeenCalledWith(TEST_USER_ID, dto);
      expect(result).toEqual(expectedResult);
    });
  });
});
