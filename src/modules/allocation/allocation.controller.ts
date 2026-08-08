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

@ApiTags('allocations')
@Controller('allocations')
export class AllocationController {
  constructor(private readonly allocationService: AllocationService) {}

  @Post()
  @ApiOperation({ summary: 'Create an allocation' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateAllocationDto) {
    return this.allocationService.create(dto);
  }

  @Post(':id/revoke')
  @ApiOperation({ summary: 'Revoke an allocation' })
  @ApiResponse({ status: 404, description: 'Allocation not found' })
  @HttpCode(HttpStatus.OK) // Revoke is not a CREATED operation
  revoke(@Param('id') id: string) {
    return this.allocationService.revoke(id);
  }

  @Get('transaction/:txnId')
  @ApiOperation({ summary: 'Find allocations by transaction ID' })
  findByTransaction(@Param('txnId') txnId: string) {
    return this.allocationService.findByTransaction(txnId);
  }

  @Get('ledger-entry/:ledgerEntryId')
  @ApiOperation({ summary: 'Find allocations by ledger entry ID' })
  findByLedgerEntry(@Param('ledgerEntryId') ledgerEntryId: string) {
    return this.allocationService.findByLedgerEntry(ledgerEntryId);
  }
}
