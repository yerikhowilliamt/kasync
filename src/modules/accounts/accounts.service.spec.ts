import { Test, TestingModule } from '@nestjs/testing';
import { AccountsService } from './accounts.service';
import { PrismaService } from '../prisma/prisma.service';
import { AccountType } from '@prisma/client';
import { NotFoundException } from '@nestjs/common';

describe('AccountsService', () => {
  let service: AccountsService;
  let prisma: PrismaService;

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
              findUnique: jest.fn(),
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
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const createSpy = jest
        .spyOn(prisma.account, 'create')
        .mockResolvedValue(expected);

      const result = await service.create(createDto);
      expect(result).toEqual(expected);
      expect(createSpy).toHaveBeenCalledWith({ data: createDto });
    });
  });

  describe('findOne', () => {
    it('should return account if found', async () => {
      const expected = {
        id: '1',
        name: 'Test',
        type: AccountType.CASH,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      jest.spyOn(prisma.account, 'findUnique').mockResolvedValue(expected);

      const result = await service.findOne('1');
      expect(result).toEqual(expected);
    });

    it('should throw NotFoundException if not found', async () => {
      jest.spyOn(prisma.account, 'findUnique').mockResolvedValue(null);

      let error;
      try {
        await service.findOne('1');
      } catch (e) {
        error = e;
      }
      expect(error).toBeInstanceOf(NotFoundException);
    });
  });
});
