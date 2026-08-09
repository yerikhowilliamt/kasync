import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AllocationService } from './allocation.service';
import { CreateAllocationDto } from './dto/create-allocation.dto';
import { ReqUser } from '../../common/decorators/req-user.decorator';

@ApiTags('allocations')
@Controller('allocations')
export class AllocationController {
  constructor(private readonly allocationService: AllocationService) {}

  @Post()
  @ApiOperation({ summary: 'Create an allocation' })
  @ApiResponse({ status: 201, description: 'Allocation created successfully' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({
    status: 404,
    description: 'Transaction or Ledger Entry not found',
  })
  @HttpCode(HttpStatus.CREATED)
  create(@ReqUser('sub') userId: string, @Body() dto: CreateAllocationDto) {
    return this.allocationService.create(dto, userId);
  }

  @Post(':id/revoke')
  @ApiOperation({ summary: 'Revoke an allocation' })
  @ApiResponse({ status: 200, description: 'Allocation revoked successfully' })
  @ApiResponse({ status: 404, description: 'Allocation not found' })
  @HttpCode(HttpStatus.OK)
  revoke(@ReqUser('sub') userId: string, @Param('id') id: string) {
    return this.allocationService.revoke(id, userId);
  }

  @Get('transaction/:txnId')
  @ApiOperation({ summary: 'Find allocations by transaction ID' })
  @ApiResponse({ status: 200, description: 'Allocations retrieved' })
  findByTransaction(
    @ReqUser('sub') userId: string,
    @Param('txnId') txnId: string,
  ) {
    return this.allocationService.findByTransaction(txnId, userId);
  }

  @Get('ledger-entry/:ledgerEntryId')
  @ApiOperation({ summary: 'Find allocations by ledger entry ID' })
  @ApiResponse({ status: 200, description: 'Allocations retrieved' })
  findByLedgerEntry(
    @ReqUser('sub') userId: string,
    @Param('ledgerEntryId') ledgerEntryId: string,
  ) {
    return this.allocationService.findByLedgerEntry(ledgerEntryId, userId);
  }
}
