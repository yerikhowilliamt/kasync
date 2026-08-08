import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { LedgerEntriesService } from './ledger-entries.service';
import { CreateLedgerEntryDto } from './dto/create-ledger-entry.dto';
import { UpdateLedgerEntryDto } from './dto/update-ledger-entry.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

@ApiTags('ledger-entries')
@Controller('ledger-entries')
export class LedgerEntriesController {
  constructor(private readonly ledgerEntriesService: LedgerEntriesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a ledger entry' })
  @ApiResponse({ status: 201, description: 'Created' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  create(@Body() createLedgerEntryDto: CreateLedgerEntryDto) {
    return this.ledgerEntriesService.create(createLedgerEntryDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all ledger entries (paginated)' })
  findAll(@Query() paginationQuery?: PaginationQueryDto) {
    return this.ledgerEntriesService.findAll(paginationQuery);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a ledger entry by ID' })
  @ApiResponse({ status: 404, description: 'Ledger entry not found' })
  findOne(@Param('id') id: string) {
    return this.ledgerEntriesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a ledger entry' })
  @ApiResponse({ status: 404, description: 'Ledger entry not found' })
  update(
    @Param('id') id: string,
    @Body() updateLedgerEntryDto: UpdateLedgerEntryDto,
  ) {
    return this.ledgerEntriesService.update(id, updateLedgerEntryDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a ledger entry' })
  @ApiResponse({ status: 404, description: 'Ledger entry not found' })
  remove(@Param('id') id: string) {
    return this.ledgerEntriesService.remove(id);
  }
}
