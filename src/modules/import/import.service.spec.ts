import { Test, TestingModule } from '@nestjs/testing';
import { ImportService } from './import.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';
import { BankParserFactory } from './bank-parser.factory';

describe('ImportService', () => {
  let service: ImportService;
  let prisma: PrismaService;
  const testUserId = 'user-123';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ImportService,
        BankParserFactory,
        {
          provide: PrismaService,
          useValue: {
            account: { findFirst: jest.fn() },
            bankTransaction: { createMany: jest.fn() },
          },
        },
      ],
    }).compile();

    service = module.get<ImportService>(ImportService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should throw if account not found', async () => {
    jest.spyOn(prisma.account, 'findFirst').mockResolvedValue(null);
    let error;
    try {
      await service.importCsv('1', 'BCA', Buffer.from(''), testUserId);
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(NotFoundException);
  });

  it('should parse and import successfully', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    jest.spyOn(prisma.account, 'findFirst').mockResolvedValue({
      id: '1',
      name: 'Test',
      type: 'BANK',
      createdAt: new Date(),
      updatedAt: new Date(),
      userId: testUserId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    const createManySpy = jest
      .spyOn(prisma.bankTransaction, 'createMany')
      .mockResolvedValue({ count: 1 });

    const csvContent = Buffer.from('15/01/2024,TRF IN,0000,150000.00,CR');
    const result = await service.importCsv('1', 'BCA', csvContent, testUserId);
    expect(result).toEqual({
      totalParsed: 1,
      importedCount: 1,
      duplicateCount: 0,
      failedCount: 0,
      errors: [],
    });
    expect(createManySpy).toHaveBeenCalledWith(
      expect.objectContaining({ skipDuplicates: true }),
    );
  });
});
