import { Controller, Get, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckService,
  PrismaHealthIndicator,
} from '@nestjs/terminus';
import type { Response } from 'express';
import { register } from 'prom-client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Health')
@Controller()
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaHealth: PrismaHealthIndicator,
    private readonly prisma: PrismaService,
  ) {}

  @Get('health')
  @Public()
  @HealthCheck()
  @ApiOperation({ summary: 'Check system and database health status' })
  @ApiResponse({ status: 200, description: 'System healthy' })
  @ApiResponse({ status: 503, description: 'Service unavailable' })
  check() {
    return this.health.check([
      () => this.prismaHealth.pingCheck('database', this.prisma),
    ]);
  }

  @Get('metrics')
  @Public()
  @ApiOperation({ summary: 'Prometheus application metrics' })
  @ApiResponse({ status: 200, description: 'Prometheus metrics string' })
  async getMetrics(@Res() res: Response) {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  }
}
