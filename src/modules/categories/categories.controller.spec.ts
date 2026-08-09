import { Test, TestingModule } from '@nestjs/testing';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';

describe('CategoriesController', () => {
  let controller: CategoriesController;
  let service: CategoriesService;
  const testUserId = 'user-123';

  const mockCategory = { id: 'test-id', name: 'test-category', userId: testUserId };

  const mockCategoriesService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CategoriesController],
      providers: [{ provide: CategoriesService, useValue: mockCategoriesService }],
    }).compile();

    controller = module.get<CategoriesController>(CategoriesController);
    service = module.get<CategoriesService>(CategoriesService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => expect(controller).toBeDefined());

  describe('create', () => {
    it('should create a category', async () => {
      mockCategoriesService.create.mockResolvedValue(mockCategory);
      const result = await controller.create(testUserId, { name: 'test-category' });
      expect(result).toEqual(mockCategory);
      expect(service.create).toHaveBeenCalledWith({ name: 'test-category' }, testUserId);
    });
  });

  describe('findAll', () => {
    it('should get all categories for a user', async () => {
      mockCategoriesService.findAll.mockResolvedValue([mockCategory]);
      const result = await controller.findAll(testUserId);
      expect(result).toEqual([mockCategory]);
      expect(service.findAll).toHaveBeenCalledWith(testUserId);
    });
  });

  describe('findOne', () => {
    it('should get a category by ID', async () => {
      mockCategoriesService.findOne.mockResolvedValue(mockCategory);
      const result = await controller.findOne(testUserId, 'test-id');
      expect(result).toEqual(mockCategory);
      expect(service.findOne).toHaveBeenCalledWith('test-id', testUserId);
    });
  });

  describe('update', () => {
    it('should update a category', async () => {
      mockCategoriesService.update.mockResolvedValue(mockCategory);
      const result = await controller.update(testUserId, 'test-id', { name: 'updated' });
      expect(result).toEqual(mockCategory);
      expect(service.update).toHaveBeenCalledWith('test-id', { name: 'updated' }, testUserId);
    });
  });

  describe('remove', () => {
    it('should remove a category', async () => {
      mockCategoriesService.remove.mockResolvedValue(mockCategory);
      const result = await controller.remove(testUserId, 'test-id');
      expect(result).toEqual(mockCategory);
      expect(service.remove).toHaveBeenCalledWith('test-id', testUserId);
    });
  });
});
