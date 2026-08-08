import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { PrismaModule } from './common/prisma/prisma.module';
import { ImportModule } from './modules/import/import.module';
import { MatchingModule } from './modules/matching/matching.module';
import { AllocationModule } from './modules/allocation/allocation.module';
import { AccountsModule } from './modules/accounts/accounts.module';
import { ReconciliationModule } from './modules/reconciliation/reconciliation.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { BranchesModule } from './modules/branches/branches.module';
import { LedgerEntriesModule } from './modules/ledger-entries/ledger-entries.module';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty' }
            : undefined,
      },
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    PrismaModule,
    AuthModule,
    ImportModule,
    MatchingModule,
    AllocationModule,
    AccountsModule,
    ReconciliationModule,
    CategoriesModule,
    BranchesModule,
    LedgerEntriesModule,
    HealthModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
