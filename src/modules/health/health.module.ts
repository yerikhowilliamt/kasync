import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { HealthController } from './health.controller';

@Module({
  imports: [
    TerminusModule,
    PrometheusModule.register({
      path: '/metrics',
    }),
  ],
  controllers: [HealthController],
})
export class HealthModule {}
