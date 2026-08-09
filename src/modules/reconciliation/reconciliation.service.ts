import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { DashboardQueryDto } from './dto/dashboard-query.dto';
import { TransactionStatus, AllocationStatus, Prisma } from '@prisma/client';
import Decimal from 'decimal.js';

export interface DashboardSummaryResponse {
  counts: Record<TransactionStatus, number>;
  actualBankBalance: string;
  recordedLedgerBalance: string;
  variance: string;
}

@Injectable()
export class ReconciliationService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboardSummary(
    userId: string,
    query: DashboardQueryDto,
  ): Promise<DashboardSummaryResponse> {
    const bankTxnWhere: Prisma.BankTransactionWhereInput = {
      account: { userId },
    };
    const ledgerWhere: Prisma.LedgerEntryWhereInput = { userId };

    if (query.accountId) {
      bankTxnWhere.accountId = query.accountId;
    }

    if (query.type) {
      bankTxnWhere.type = query.type;
      ledgerWhere.type = query.type;
    }

    if (query.status) {
      bankTxnWhere.status = query.status;
    }

    if (query.startDate || query.endDate) {
      bankTxnWhere.txnDate = {};
      ledgerWhere.entryDate = {};

      if (query.startDate) {
        const start = new Date(query.startDate);
        bankTxnWhere.txnDate.gte = start;
        ledgerWhere.entryDate.gte = start;
      }
      if (query.endDate) {
        const end = new Date(query.endDate);
        bankTxnWhere.txnDate.lte = end;
        ledgerWhere.entryDate.lte = end;
      }
    }

    if (query.categoryId || query.branchId) {
      const ledgerSubFilter: Prisma.LedgerEntryWhereInput = {};
      if (query.categoryId) ledgerSubFilter.categoryId = query.categoryId;
      if (query.branchId) ledgerSubFilter.branchId = query.branchId;

      bankTxnWhere.allocations = {
        some: {
          status: AllocationStatus.ACTIVE,
          ledgerEntry: ledgerSubFilter,
        },
      };

      if (query.categoryId) ledgerWhere.categoryId = query.categoryId;
      if (query.branchId) ledgerWhere.branchId = query.branchId;
    }

    const counts: Record<TransactionStatus, number> = {
      [TransactionStatus.UNRESOLVED]: 0,
      [TransactionStatus.PENDING_REVIEW]: 0,
      [TransactionStatus.PARTIALLY_ALLOCATED]: 0,
      [TransactionStatus.MATCHED]: 0,
    };

    const statusCounts = await this.prisma.bankTransaction.groupBy({
      by: ['status'],
      where: bankTxnWhere,
      _count: {
        _all: true,
      },
    });

    for (const sc of statusCounts) {
      counts[sc.status] = sc._count._all;
    }

    const [bankInflowSum, bankOutflowSum] = await Promise.all([
      this.prisma.bankTransaction.aggregate({
        _sum: { amount: true },
        where: { ...bankTxnWhere, type: 'INFLOW' },
      }),
      this.prisma.bankTransaction.aggregate({
        _sum: { amount: true },
        where: { ...bankTxnWhere, type: 'OUTFLOW' },
      }),
    ]);

    const bankInflowDec = new Decimal(
      bankInflowSum._sum.amount?.toString() ?? '0',
    );
    const bankOutflowDec = new Decimal(
      bankOutflowSum._sum.amount?.toString() ?? '0',
    );
    const actualBankBalanceDec = bankInflowDec.minus(bankOutflowDec);

    const [ledgerInflowSum, ledgerOutflowSum] = await Promise.all([
      this.prisma.ledgerEntry.aggregate({
        _sum: { amount: true },
        where: { ...ledgerWhere, type: 'INFLOW' },
      }),
      this.prisma.ledgerEntry.aggregate({
        _sum: { amount: true },
        where: { ...ledgerWhere, type: 'OUTFLOW' },
      }),
    ]);

    const ledgerInflowDec = new Decimal(
      ledgerInflowSum._sum.amount?.toString() ?? '0',
    );
    const ledgerOutflowDec = new Decimal(
      ledgerOutflowSum._sum.amount?.toString() ?? '0',
    );
    const recordedLedgerBalanceDec = ledgerInflowDec.minus(ledgerOutflowDec);

    const varianceDec = actualBankBalanceDec.minus(recordedLedgerBalanceDec);

    return {
      counts,
      actualBankBalance: actualBankBalanceDec.toFixed(2),
      recordedLedgerBalance: recordedLedgerBalanceDec.toFixed(2),
      variance: varianceDec.toFixed(2),
    };
  }
}
