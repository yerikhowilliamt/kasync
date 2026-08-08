import { Module } from '@nestjs/common';
import { ImportService } from './import.service';
import { ImportController } from './import.controller';
import { PrismaModule } from '../prisma/prisma.module'; // Assume exists

@Module({
  imports: [PrismaModule],
  controllers: [ImportController],
  providers: [ImportService],
})
export class ImportModule {}
