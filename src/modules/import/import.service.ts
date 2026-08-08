import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BcaCsvParser } from './parsers/bca-csv.parser';
import { MandiriCsvParser } from './parsers/mandiri-csv.parser';
import { BankParser } from './interfaces/bank-parser.interface';

@Injectable()
export class ImportService {
  constructor(private prisma: PrismaService) {}

  async importCsv(accountId: string, format: string, fileBuffer: Buffer) {
    // Validate account
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      throw new NotFoundException(`Account ${accountId} not found`);
    }

    let parser: BankParser;
    switch (format.toUpperCase()) {
      case 'BCA':
        parser = new BcaCsvParser();
        break;
      case 'MANDIRI':
        parser = new MandiriCsvParser();
        break;
      default:
        throw new BadRequestException(`Unsupported format: ${format}`);
    }

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
