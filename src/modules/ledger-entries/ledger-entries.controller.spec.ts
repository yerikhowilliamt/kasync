import { Test, TestingModule } from '@nestjs/testing';
import { LedgerEntriesController } from './ledger-entries.controller';
import { LedgerEntriesService } from './ledger-entries.service';

import { CreateLedgerEntryDto } from './dto/create-ledger-entry.dto';
import { UpdateLedgerEntryDto } from './dto/update-ledger-entry.dto';

describe('LedgerEntriesController', () => {
  let controller: LedgerEntriesController;
  let service: LedgerEntriesService;

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
      providers: [
        {
          provide: LedgerEntriesService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<LedgerEntriesController>(LedgerEntriesController);
    service = module.get<LedgerEntriesService>(LedgerEntriesService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call create', async () => {
    const dto = { amount: 100 } as unknown as CreateLedgerEntryDto;
    await controller.create(dto);
    expect(jest.spyOn(service, 'create')).toHaveBeenCalledWith(dto);
  });

  it('should call findAll', async () => {
    await controller.findAll();
    expect(jest.spyOn(service, 'findAll')).toHaveBeenCalled();
  });

  it('should call findOne', async () => {
    await controller.findOne('1');
    expect(jest.spyOn(service, 'findOne')).toHaveBeenCalledWith('1');
  });

  it('should call update', async () => {
    const dto = { amount: 200 } as unknown as UpdateLedgerEntryDto;
    await controller.update('1', dto);
    expect(jest.spyOn(service, 'update')).toHaveBeenCalledWith('1', dto);
  });

  it('should call remove', async () => {
    await controller.remove('1');
    expect(jest.spyOn(service, 'remove')).toHaveBeenCalledWith('1');
  });
});
