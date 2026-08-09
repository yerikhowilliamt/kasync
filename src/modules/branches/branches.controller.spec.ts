import { Test, TestingModule } from '@nestjs/testing';
import { BranchesController } from './branches.controller';
import { BranchesService } from './branches.service';

describe('BranchesController', () => {
  let controller: BranchesController;
  let service: BranchesService;
  const testUserId = 'user-123';

  const mockBranch = { id: 'test-id', name: 'test-branch', userId: testUserId };

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

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => expect(controller).toBeDefined());

  describe('create', () => {
    it('should create a branch', async () => {
      mockBranchesService.create.mockResolvedValue(mockBranch);
      const result = await controller.create(testUserId, {
        name: 'test-branch',
      });
      expect(result).toEqual(mockBranch);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(service.create).toHaveBeenCalledWith(
        { name: 'test-branch' },
        testUserId,
      );
    });
  });

  describe('findAll', () => {
    it('should get all branches for a user', async () => {
      mockBranchesService.findAll.mockResolvedValue([mockBranch]);
      const result = await controller.findAll(testUserId);
      expect(result).toEqual([mockBranch]);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(service.findAll).toHaveBeenCalledWith(testUserId);
    });
  });

  describe('findOne', () => {
    it('should get a branch by ID', async () => {
      mockBranchesService.findOne.mockResolvedValue(mockBranch);
      const result = await controller.findOne(testUserId, 'test-id');
      expect(result).toEqual(mockBranch);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(service.findOne).toHaveBeenCalledWith('test-id', testUserId);
    });
  });

  describe('update', () => {
    it('should update a branch', async () => {
      mockBranchesService.update.mockResolvedValue(mockBranch);
      const result = await controller.update(testUserId, 'test-id', {
        name: 'updated',
      });
      expect(result).toEqual(mockBranch);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(service.update).toHaveBeenCalledWith(
        'test-id',
        { name: 'updated' },
        testUserId,
      );
    });
  });

  describe('remove', () => {
    it('should remove a branch', async () => {
      mockBranchesService.remove.mockResolvedValue(mockBranch);
      const result = await controller.remove(testUserId, 'test-id');
      expect(result).toEqual(mockBranch);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(service.remove).toHaveBeenCalledWith('test-id', testUserId);
    });
  });
});
