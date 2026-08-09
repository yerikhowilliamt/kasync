import { Test, TestingModule } from '@nestjs/testing';
import { AccountsService } from './accounts.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AccountType } from '@prisma/client';
import { NotFoundException } from '@nestjs/common';

describe('AccountsService', () => {
  let service: AccountsService;
  let prisma: PrismaService;
  const testUserId = 'user-123';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountsService,
        {
          provide: PrismaService,
          useValue: {
            account: {
              create: jest.fn(),
              findMany: jest.fn(),
              findFirst: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<AccountsService>(AccountsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create an account', async () => {
      const createDto = { name: 'Test Bank', type: AccountType.BANK };
      const expected = {
        id: '1',
        ...createDto,
        userId: testUserId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const createSpy = jest
        .spyOn(prisma.account, 'create')
        .mockResolvedValue(expected);

      const result = await service.create(createDto, testUserId);
      expect(result).toEqual(expected);
      expect(createSpy).toHaveBeenCalledWith({ data: { ...createDto, user: { connect: { id: testUserId } } } });
    });
  });

  describe('findAll', () => {
    it('should return accounts for user', async () => {
      const expected = [{ id: '1', name: 'Test', type: AccountType.CASH, userId: testUserId, createdAt: new Date(), updatedAt: new Date() }];
      jest.spyOn(prisma.account, 'findMany').mockResolvedValue(expected);
      const result = await service.findAll(testUserId);
      expect(result).toEqual(expected);
      expect(prisma.account.findMany).toHaveBeenCalledWith({ where: { userId: testUserId } });
    });
  });

  describe('findOne', () => {
    it('should return account if found', async () => {
      const expected = {
        id: '1', name: 'Test', type: AccountType.CASH, userId: testUserId, createdAt: new Date(), updatedAt: new Date(),
      };
      jest.spyOn(prisma.account, 'findFirst').mockResolvedValue(expected);

      const result = await service.findOne('1', testUserId);
      expect(result).toEqual(expected);
    });

    it('should throw NotFoundException if not found', async () => {
      jest.spyOn(prisma.account, 'findFirst').mockResolvedValue(null);

      let error;
      try {
        await service.findOne('1', testUserId);
      } catch (e) {
        error = e;
      }
      expect(error).toBeInstanceOf(NotFoundException);
    });
  });
});
