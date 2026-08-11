import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { BankParserFactory } from './bank-parser.factory';
import { ParsedTransactionDto } from './dto/parsed-transaction.dto';
import { plainToClass } from 'class-transformer';
import { validate } from 'class-validator';
import { ImportCsvResponseDto } from './dto/import-csv-response.dto';

@Injectable()
export class ImportService {
  private readonly logger = new Logger(ImportService.name);

  constructor(
    private prisma: PrismaService,
    private bankParserFactory: BankParserFactory,
  ) {}

  async importCsv(
    accountId: string,
    format: string,
    fileBuffer: Buffer,
    userId: string,
  ): Promise<ImportCsvResponseDto> {
    const account = await this.prisma.account.findFirst({
      where: { id: accountId, userId },
    });

    if (!account) {
      throw new NotFoundException(`Account ${accountId} not found`);
    }

    const parser = this.bankParserFactory.getParser(format);
    const parsedData = await parser.parse(fileBuffer);
    const totalParsed = parsedData.length;

    if (totalParsed === 0) {
      return {
        totalParsed: 0,
        importedCount: 0,
        duplicateCount: 0,
        failedCount: 0,
        errors: [],
      };
    }

    const validTransactions = [];
    const importErrors: ImportCsvResponseDto['errors'] = [];
    let lineNumber = 1; // Assuming 1-based indexing for user-facing errors

    for (const row of parsedData) {
      lineNumber++;
      const transactionDto = plainToClass(ParsedTransactionDto, {
        ...row,
        txnDate: row.txnDate.toISOString(),
      });
      const errors = await validate(transactionDto);

      if (errors.length > 0) {
        const errorMessage = errors
          .map((e) => Object.values(e.constraints || {}))
          .join(', ');
        this.logger.warn(
          `Validation failed for CSV row: ${JSON.stringify(
            row,
          )}. Errors: ${errorMessage}`,
        );
        importErrors.push({
          lineNumber,
          message: errorMessage,
          rowData: JSON.stringify(row),
        });
      } else {
        validTransactions.push({
          accountId,
          txnDate: row.txnDate,
          amount: row.amount,
          type: row.type,
          description: row.description,
          externalRef: row.externalRef,
          dedupHash: row.dedupHash,
        });
      }
    }

    if (validTransactions.length === 0) {
      return {
        totalParsed,
        importedCount: 0,
        duplicateCount: 0,
        failedCount: importErrors.length,
        errors: importErrors,
      };
    }

    const result = await this.prisma.bankTransaction.createMany({
      data: validTransactions,
      skipDuplicates: true,
    });

    return {
      totalParsed,
      importedCount: result.count,
      duplicateCount: validTransactions.length - result.count,
      failedCount: importErrors.length,
      errors: importErrors,
    };
  }
}
