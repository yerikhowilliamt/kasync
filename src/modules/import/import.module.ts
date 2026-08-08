import { Module } from '@nestjs/common';
import { ImportService } from './import.service';
import { ImportController } from './import.controller';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { BankParserFactory } from './bank-parser.factory';

@Module({
  imports: [PrismaModule],
  controllers: [ImportController],
  providers: [ImportService, BankParserFactory],
})
export class ImportModule {}
