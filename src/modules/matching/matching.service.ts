import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ProposeMatchesDto } from './dto/propose-matches.dto';
import {
  MatchingEngine,
  BankTransactionInput,
  LedgerEntryInput,
} from './matching-engine';
import Decimal from 'decimal.js';

import { TransactionStatus } from '@prisma/client';

@Injectable()
export class MatchingService {
  constructor(private readonly prisma: PrismaService) {}

  async proposeMatches(userId: string, dto?: ProposeMatchesDto) {
    const bankTxnWhere: Record<string, unknown> = {
      status: TransactionStatus.UNRESOLVED,
      account: { userId },
    };

    if (dto?.accountId) {
      bankTxnWhere.accountId = dto.accountId;
    }

    const bankTxns = await this.prisma.bankTransaction.findMany({
      where: bankTxnWhere,
    });

    const ledgerEntries = await this.prisma.ledgerEntry.findMany({
      where: { userId },
    });

    const bankInputs: BankTransactionInput[] = bankTxns.map((tx) => ({
      id: tx.id,
      amount: new Decimal(tx.amount.toString()),
      type: tx.type,
      txnDate: new Date(tx.txnDate),
    }));

    const ledgerInputs: LedgerEntryInput[] = ledgerEntries.map((le) => ({
      id: le.id,
      amount: new Decimal(le.amount.toString()),
      type: le.type,
      entryDate: new Date(le.entryDate),
    }));

    const engine = new MatchingEngine();
    const candidates = engine.proposeMatches(bankInputs, ledgerInputs, {
      dateToleranceDays: dto?.dateToleranceDays,
      maxAggregationSubsetSize: dto?.maxAggregationSubsetSize,
      maxCandidates: dto?.maxCandidates,
    });

    const bankTxnIdsToUpdate = new Set<string>();
    for (const candidate of candidates) {
      for (const id of candidate.bankTransactionIds) {
        bankTxnIdsToUpdate.add(id);
      }
    }

    if (bankTxnIdsToUpdate.size > 0) {
      await this.prisma.bankTransaction.updateMany({
        where: {
          id: { in: Array.from(bankTxnIdsToUpdate) },
          account: { userId },
        },
        data: { status: TransactionStatus.PENDING_REVIEW },
      });
    }

    return candidates;
  }

  async resetMatches(userId: string, accountId?: string) {
    const where: Record<string, unknown> = {
      status: TransactionStatus.PENDING_REVIEW,
      account: { userId },
    };
    if (accountId) {
      where.accountId = accountId;
    }

    const result = await this.prisma.bankTransaction.updateMany({
      where,
      data: { status: TransactionStatus.UNRESOLVED },
    });

    return { resetCount: result.count };
  }
}
