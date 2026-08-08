import { Test, TestingModule } from '@nestjs/testing';
import { ImportController } from './import.controller';
import { ImportService } from './import.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { BankParserFactory } from './bank-parser.factory';

describe('ImportController', () => {
  let controller: ImportController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ImportController],
      providers: [
        ImportService,
        BankParserFactory,
        {
          provide: PrismaService,
          useValue: {},
        }
      ]
    }).compile();

    controller = module.get<ImportController>(ImportController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
