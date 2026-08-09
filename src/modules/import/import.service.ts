import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { BankParserFactory } from './bank-parser.factory';

@Injectable()
export class ImportService {
  constructor(
    private prisma: PrismaService,
    private bankParserFactory: BankParserFactory,
  ) {}

  async importCsv(accountId: string, format: string, fileBuffer: Buffer, userId: string) {
    const account = await this.prisma.account.findFirst({
      where: { id: accountId, userId },
    });

    if (!account) {
      throw new NotFoundException(`Account ${accountId} not found`);
    }

    const parser = this.bankParserFactory.getParser(format);
    const parsedData = await parser.parse(fileBuffer);

    if (parsedData.length === 0) {
      return { totalParsed: 0, importedCount: 0, duplicateCount: 0 };
    }

    const transactionsToInsert = parsedData.map((t) => ({
      accountId,
      txnDate: t.txnDate,
      amount: t.amount,
      type: t.type,
      description: t.description,
      externalRef: t.externalRef,
      dedupHash: t.dedupHash,
    }));

    const result = await this.prisma.bankTransaction.createMany({
      data: transactionsToInsert,
      skipDuplicates: true,
    });

    return {
      totalParsed: parsedData.length,
      importedCount: result.count,
      duplicateCount: parsedData.length - result.count,
    };
  }
}
