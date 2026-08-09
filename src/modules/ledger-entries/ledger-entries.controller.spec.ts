import { Test, TestingModule } from '@nestjs/testing';
import { LedgerEntriesController } from './ledger-entries.controller';
import { LedgerEntriesService } from './ledger-entries.service';

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
    const dto = { amount: 100 } as any;
    await controller.create(testUserId, dto);
    expect(service.create).toHaveBeenCalledWith(dto, testUserId);
  });

  it('should call findAll', async () => {
    const query = { page: 1, limit: 10 } as any;
    await controller.findAll(testUserId, query);
    expect(service.findAll).toHaveBeenCalledWith(testUserId, query);
  });

  it('should call findOne', async () => {
    await controller.findOne(testUserId, '1');
    expect(service.findOne).toHaveBeenCalledWith('1', testUserId);
  });

  it('should call update', async () => {
    const dto = { amount: 200 } as any;
    await controller.update(testUserId, '1', dto);
    expect(service.update).toHaveBeenCalledWith('1', dto, testUserId);
  });

  it('should call remove', async () => {
    await controller.remove(testUserId, '1');
    expect(service.remove).toHaveBeenCalledWith('1', testUserId);
  });
});
