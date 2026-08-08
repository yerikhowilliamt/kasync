import { Test, TestingModule } from '@nestjs/testing';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';

describe('CategoriesController', () => {
  let controller: CategoriesController;
  let service: CategoriesService;

  const mockCategory = {
    id: 'test-id',
    name: 'test-category',
  };

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
      providers: [
        { provide: CategoriesService, useValue: mockCategoriesService },
      ],
    }).compile();

    controller = module.get<CategoriesController>(CategoriesController);
    service = module.get<CategoriesService>(CategoriesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a category', async () => {
      mockCategoriesService.create.mockResolvedValue(mockCategory);
      const result = await controller.create({ name: 'test-category' });
      expect(result).toEqual(mockCategory);
      expect(jest.spyOn(service, 'create')).toHaveBeenCalledWith({
        name: 'test-category',
      });
    });
  });

  describe('findAll', () => {
    it('should get all categories', async () => {
      mockCategoriesService.findAll.mockResolvedValue([mockCategory]);
      const result = await controller.findAll();
      expect(result).toEqual([mockCategory]);
      expect(jest.spyOn(service, 'findAll')).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should get a category by ID', async () => {
      mockCategoriesService.findOne.mockResolvedValue(mockCategory);
      const result = await controller.findOne('test-id');
      expect(result).toEqual(mockCategory);
      expect(jest.spyOn(service, 'findOne')).toHaveBeenCalledWith('test-id');
    });
  });

  describe('update', () => {
    it('should update a category', async () => {
      mockCategoriesService.update.mockResolvedValue(mockCategory);
      const result = await controller.update('test-id', { name: 'updated' });
      expect(result).toEqual(mockCategory);
      expect(jest.spyOn(service, 'update')).toHaveBeenCalledWith('test-id', {
        name: 'updated',
      });
    });
  });

  describe('remove', () => {
    it('should remove a category', async () => {
      mockCategoriesService.remove.mockResolvedValue(mockCategory);
      const result = await controller.remove('test-id');
      expect(result).toEqual(mockCategory);
      expect(jest.spyOn(service, 'remove')).toHaveBeenCalledWith('test-id');
    });
  });
});
