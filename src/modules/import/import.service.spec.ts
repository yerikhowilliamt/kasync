import { Test, TestingModule } from '@nestjs/testing';
import { ImportService } from './import.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('ImportService', () => {
  let service: ImportService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ImportService,
        {
          provide: PrismaService,
          useValue: {
            account: {
              findUnique: jest.fn(),
            },
            bankTransaction: {
              createMany: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<ImportService>(ImportService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should throw if account not found', async () => {
    jest.spyOn(prisma.account, 'findUnique').mockResolvedValue(null);
    let error;
    try {
      await service.importCsv('1', 'BCA', Buffer.from(''));
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(NotFoundException);
  });

  it('should parse and import successfully', async () => {
    jest.spyOn(prisma.account, 'findUnique').mockResolvedValue({
      id: '1',
      name: 'Test',
      type: 'BANK',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const createManySpy = jest
      .spyOn(prisma.bankTransaction, 'createMany')
      .mockResolvedValue({ count: 1 });

    // valid BCA-ish row: Date | Desc | Branch | Amount | CR/DB
    const csvContent = Buffer.from('15/01/2024,TRF IN,0000,150000.00,CR');

    const result = await service.importCsv('1', 'BCA', csvContent);
    expect(result).toEqual({
      totalParsed: 1,
      importedCount: 1,
      duplicateCount: 0,
    });
    expect(createManySpy).toHaveBeenCalledWith(
      expect.objectContaining({ skipDuplicates: true }),
    );
  });
});
