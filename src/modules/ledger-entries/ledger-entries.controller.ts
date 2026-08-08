import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { LedgerEntriesService } from './ledger-entries.service';
import { CreateLedgerEntryDto } from './dto/create-ledger-entry.dto';
import { UpdateLedgerEntryDto } from './dto/update-ledger-entry.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('ledger-entries')
@Controller('ledger-entries')
export class LedgerEntriesController {
  constructor(private readonly ledgerEntriesService: LedgerEntriesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a ledger entry' })
  @ApiResponse({ status: 201, description: 'Created' })
  create(@Body() createLedgerEntryDto: CreateLedgerEntryDto) {
    return this.ledgerEntriesService.create(createLedgerEntryDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all ledger entries' })
  findAll() {
    return this.ledgerEntriesService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a ledger entry by ID' })
  findOne(@Param('id') id: string) {
    return this.ledgerEntriesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a ledger entry' })
  update(
    @Param('id') id: string,
    @Body() updateLedgerEntryDto: UpdateLedgerEntryDto,
  ) {
    return this.ledgerEntriesService.update(id, updateLedgerEntryDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a ledger entry' })
  remove(@Param('id') id: string) {
    return this.ledgerEntriesService.remove(id);
  }
}
