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
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { ReqUser } from '../../common/decorators/req-user.decorator';

@ApiTags('ledger-entries')
@Controller('ledger-entries')
export class LedgerEntriesController {
  constructor(private readonly ledgerEntriesService: LedgerEntriesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a ledger entry' })
  create(@ReqUser('sub') userId: string, @Body() dto: CreateLedgerEntryDto) {
    return this.ledgerEntriesService.create(dto, userId);
  }

  @Get()
  @ApiOperation({ summary: 'Get all ledger entries (paginated)' })
  findAll(
    @ReqUser('sub') userId: string,
    @Query() paginationQuery?: PaginationQueryDto,
  ) {
    return this.ledgerEntriesService.findAll(userId, paginationQuery);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a ledger entry by ID' })
  findOne(@ReqUser('sub') userId: string, @Param('id') id: string) {
    return this.ledgerEntriesService.findOne(id, userId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a ledger entry' })
  update(
    @ReqUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateLedgerEntryDto,
  ) {
    return this.ledgerEntriesService.update(id, dto, userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a ledger entry' })
  remove(@ReqUser('sub') userId: string, @Param('id') id: string) {
    return this.ledgerEntriesService.remove(id, userId);
  }
}
