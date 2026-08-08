import { Controller, Post, Get, Body, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { AllocationService } from './allocation.service';
import { CreateAllocationDto } from './dto/create-allocation.dto';

@Controller('allocations')
export class AllocationController {
  constructor(private readonly allocationService: AllocationService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateAllocationDto) {
    return this.allocationService.create(dto);
  }

  @Post(':id/revoke')
  @HttpCode(HttpStatus.CREATED)
  revoke(@Param('id') id: string) {
    return this.allocationService.revoke(id);
  }

  @Get('transaction/:txnId')
  findByTransaction(@Param('txnId') txnId: string) {
    return this.allocationService.findByTransaction(txnId);
  }

  @Get('ledger-entry/:ledgerEntryId')
  findByLedgerEntry(@Param('ledgerEntryId') ledgerEntryId: string) {
    return this.allocationService.findByLedgerEntry(ledgerEntryId);
  }
}
