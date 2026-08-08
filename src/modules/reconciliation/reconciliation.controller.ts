import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
  ReconciliationService,
  DashboardSummaryResponse,
} from './reconciliation.service';
import { DashboardQueryDto } from './dto/dashboard-query.dto';

@ApiTags('reconciliation')
@Controller('reconciliation')
export class ReconciliationController {
  constructor(private readonly reconciliationService: ReconciliationService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Get reconciliation dashboard summary' })
  @ApiResponse({
    status: 200,
    description:
      'Dashboard summary containing transaction status counts and balance variance.',
  })
  async getDashboardSummary(
    @Query() query: DashboardQueryDto,
  ): Promise<DashboardSummaryResponse> {
    return this.reconciliationService.getDashboardSummary(query);
  }
}
