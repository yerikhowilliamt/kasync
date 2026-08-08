import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { PrismaModule } from './common/prisma/prisma.module';
import { ImportModule } from './modules/import/import.module';
import { MatchingModule } from './modules/matching/matching.module';
import { AllocationModule } from './modules/allocation/allocation.module';
import { AccountsModule } from './modules/accounts/accounts.module';
import { ReconciliationModule } from './modules/reconciliation/reconciliation.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { BranchesModule } from './modules/branches/branches.module';
import { LedgerEntriesModule } from './modules/ledger-entries/ledger-entries.module';

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
    PrismaModule,
    ImportModule,
    MatchingModule,
    AllocationModule,
    AccountsModule,
    ReconciliationModule,
    CategoriesModule,
    BranchesModule,
    LedgerEntriesModule,
  ],
})
export class AppModule {}
