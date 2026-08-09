import { Test, TestingModule } from '@nestjs/testing';
import { LedgerEntriesController } from './ledger-entries.controller';
import { LedgerEntriesService } from './ledger-entries.service';
import { CreateLedgerEntryDto } from './dto/create-ledger-entry.dto';
import { UpdateLedgerEntryDto } from './dto/update-ledger-entry.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

describe('LedgerEntriesController', () => {
  let controller: LedgerEntriesController;
  let service: LedgerEntriesService;
  const testUserId = 'user-123';

  const mockService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LedgerEntriesController],
      providers: [{ provide: LedgerEntriesService, useValue: mockService }],
    }).compile();

    controller = module.get<LedgerEntriesController>(LedgerEntriesController);
    service = module.get<LedgerEntriesService>(LedgerEntriesService);
  });

  it('should be defined', () => expect(controller).toBeDefined());

  it('should call create', async () => {
    const dto = { amount: 100 } as CreateLedgerEntryDto;
    await controller.create(testUserId, dto);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(service.create).toHaveBeenCalledWith(dto, testUserId);
  });

  it('should call findAll', async () => {
    const query = { page: 1, limit: 10 } as PaginationQueryDto;
    await controller.findAll(testUserId, query);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(service.findAll).toHaveBeenCalledWith(testUserId, query);
  });

  it('should call findOne', async () => {
    await controller.findOne(testUserId, '1');
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(service.findOne).toHaveBeenCalledWith('1', testUserId);
  });

  it('should call update', async () => {
    const dto = { amount: 200 } as UpdateLedgerEntryDto;
    await controller.update(testUserId, '1', dto);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(service.update).toHaveBeenCalledWith('1', dto, testUserId);
  });

  it('should call remove', async () => {
    await controller.remove(testUserId, '1');
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(service.remove).toHaveBeenCalledWith('1', testUserId);
  });
});
