import { Test, TestingModule } from '@nestjs/testing';
import { AllocationController } from './allocation.controller';
import { AllocationService } from './allocation.service';
import { CreateAllocationDto } from './dto/create-allocation.dto';

describe('AllocationController', () => {
  const TEST_USER_ID = 'test-user-id';

  let controller: AllocationController;
  let service: AllocationService;

  const mockAllocationService = {
    create: jest.fn(),
    revoke: jest.fn(),
    findByTransaction: jest.fn(),
    findByLedgerEntry: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AllocationController],
      providers: [
        {
          provide: AllocationService,
          useValue: mockAllocationService,
        },
      ],
    }).compile();

    controller = module.get<AllocationController>(AllocationController);
    service = module.get<AllocationService>(AllocationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should call AllocationService.create with correct data', async () => {
      const dto: CreateAllocationDto = {
        bankTransactionId: 'txn-1',
        ledgerEntryId: 'entry-1',
        amountPortion: 100,
      };
      const result = [{ id: 'alloc-1' }];
      mockAllocationService.create.mockResolvedValue(result);

      expect(await controller.create(TEST_USER_ID, dto)).toBe(result);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(service.create).toHaveBeenCalledWith(dto, TEST_USER_ID);
    });
  });

  describe('revoke', () => {
    it('should call AllocationService.revoke with correct id', async () => {
      const result = { id: 'alloc-1', status: 'REVOKED' };
      mockAllocationService.revoke.mockResolvedValue(result);

      expect(await controller.revoke(TEST_USER_ID, 'alloc-1')).toBe(result);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(service.revoke).toHaveBeenCalledWith('alloc-1', TEST_USER_ID);
    });
  });

  describe('findByTransaction', () => {
    it('should call AllocationService.findByTransaction', async () => {
      const result = [{ id: 'alloc-1' }];
      mockAllocationService.findByTransaction.mockResolvedValue(result);

      expect(await controller.findByTransaction(TEST_USER_ID, 'txn-1')).toBe(
        result,
      );
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(service.findByTransaction).toHaveBeenCalledWith(
        'txn-1',
        TEST_USER_ID,
      );
    });
  });

  describe('findByLedgerEntry', () => {
    it('should call AllocationService.findByLedgerEntry', async () => {
      const result = [{ id: 'alloc-1' }];
      mockAllocationService.findByLedgerEntry.mockResolvedValue(result);

      expect(await controller.findByLedgerEntry(TEST_USER_ID, 'entry-1')).toBe(
        result,
      );
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(service.findByLedgerEntry).toHaveBeenCalledWith(
        'entry-1',
        TEST_USER_ID,
      );
    });
  });
});
