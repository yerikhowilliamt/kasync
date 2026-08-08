import { Module } from '@nestjs/common';
import { AllocationService } from './allocation.service';
import { AllocationController } from './allocation.controller';
import { PrismaModule } from '../../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AllocationController],
  providers: [AllocationService],
  exports: [AllocationService],
})
export class AllocationModule {}
