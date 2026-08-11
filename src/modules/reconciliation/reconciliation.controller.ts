import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
  ReconciliationService,
  DashboardSummaryResponse,
  PaginatedTransactionsResponse,
} from './reconciliation.service';
import { DashboardQueryDto } from './dto/dashboard-query.dto';
import { ReqUser } from '../../common/decorators/req-user.decorator';

@ApiTags('reconciliation')
@Controller('reconciliation')
export class ReconciliationController {
  constructor(private readonly reconciliationService: ReconciliationService) {}

  @Get('dashboard')
  @ApiOperation({
    summary: 'Get reconciliation dashboard summary',
  })
  @ApiResponse({
    status: 200,
    description:
      'Dashboard summary containing transaction status counts and balance variance.',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request',
  })
  async getDashboardSummary(
    @ReqUser('sub') userId: string,
    @Query() query: DashboardQueryDto,
  ): Promise<DashboardSummaryResponse> {
    return this.reconciliationService.getDashboardSummary(userId, query);
  }

  @Get('transactions')
  @ApiOperation({
    summary: 'Get paginated list of bank transactions',
  })
  @ApiResponse({
    status: 200,
    description:
      'Paginated list of bank transactions matching the filter criteria.',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request',
  })
  async getTransactions(
    @ReqUser('sub') userId: string,
    @Query() query: DashboardQueryDto,
  ): Promise<PaginatedTransactionsResponse> {
    return this.reconciliationService.getTransactions(userId, query);
  }
}
