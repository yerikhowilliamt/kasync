import { Test, TestingModule } from '@nestjs/testing';
import { BranchesController } from './branches.controller';
import { BranchesService } from './branches.service';

describe('BranchesController', () => {
  let controller: BranchesController;
  let service: BranchesService;

  const mockBranch = {
    id: 'test-id',
    name: 'test-branch',
  };

  const mockBranchesService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BranchesController],
      providers: [{ provide: BranchesService, useValue: mockBranchesService }],
    }).compile();

    controller = module.get<BranchesController>(BranchesController);
    service = module.get<BranchesService>(BranchesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a branch', async () => {
      mockBranchesService.create.mockResolvedValue(mockBranch);
      const result = await controller.create({ name: 'test-branch' });
      expect(result).toEqual(mockBranch);
      expect(service.create).toHaveBeenCalledWith({ name: 'test-branch' });
    });
  });

  describe('findAll', () => {
    it('should get all branches', async () => {
      mockBranchesService.findAll.mockResolvedValue([mockBranch]);
      const result = await controller.findAll();
      expect(result).toEqual([mockBranch]);
      expect(service.findAll).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should get a branch by ID', async () => {
      mockBranchesService.findOne.mockResolvedValue(mockBranch);
      const result = await controller.findOne('test-id');
      expect(result).toEqual(mockBranch);
      expect(service.findOne).toHaveBeenCalledWith('test-id');
    });
  });

  describe('update', () => {
    it('should update a branch', async () => {
      mockBranchesService.update.mockResolvedValue(mockBranch);
      const result = await controller.update('test-id', { name: 'updated' });
      expect(result).toEqual(mockBranch);
      expect(service.update).toHaveBeenCalledWith('test-id', {
        name: 'updated',
      });
    });
  });

  describe('remove', () => {
    it('should remove a branch', async () => {
      mockBranchesService.remove.mockResolvedValue(mockBranch);
      const result = await controller.remove('test-id');
      expect(result).toEqual(mockBranch);
      expect(service.remove).toHaveBeenCalledWith('test-id');
    });
  });
});
