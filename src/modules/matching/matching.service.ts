import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ProposeMatchesDto } from './dto/propose-matches.dto';
import {
  MatchingEngine,
  BankTransactionInput,
  LedgerEntryInput,
} from './matching-engine';
import { Decimal } from 'decimal.js';

import { TransactionStatus } from '@prisma/client';

@Injectable()
export class MatchingService {
  constructor(private readonly prisma: PrismaService) {}

  async proposeMatches(dto?: ProposeMatchesDto) {
    const bankTxnWhere = dto?.accountId
      ? { status: TransactionStatus.UNRESOLVED, accountId: dto.accountId }
      : { status: TransactionStatus.UNRESOLVED };

    const bankTxns = await this.prisma.bankTransaction.findMany({
      where: bankTxnWhere,
    });

    // Suboptimal query but matches requirements. Ideally we exclude ledger entries fully allocated
    const ledgerEntries = await this.prisma.ledgerEntry.findMany({});

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
        where: { id: { in: Array.from(bankTxnIdsToUpdate) } },
        data: { status: TransactionStatus.PENDING_REVIEW },
      });
    }

    return candidates;
  }
}
