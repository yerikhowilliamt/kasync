import {
  BankParser,
  ParsedTransaction,
} from '../interfaces/bank-parser.interface';
import { parse } from 'csv-parse/sync';
import * as crypto from 'crypto';
import { TransactionType } from '@prisma/client';

export class MandiriCsvParser implements BankParser {
  parse(fileBuffer: Buffer): Promise<ParsedTransaction[]> {
    const records = parse(fileBuffer, {
      skip_empty_lines: true,
      relax_column_count: true,
      trim: true,
    });

    const parsed: ParsedTransaction[] = [];

    for (const record of records) {
      if (record.length < 5) continue;

      const dateStr = record[0];
      if (!/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
        continue;
      }

      const [day, month, year] = dateStr.split('/');
      const txnDate = new Date(
        Date.UTC(Number(year), Number(month) - 1, Number(day)),
      );

      const description = record[1];
      const externalRef = record[2] ? record[2] : null;

      const inflowRaw = record[3].replace(/,/g, '');
      const outflowRaw = record[4].replace(/,/g, '');

      let amount = '0.00';
      let type: TransactionType = TransactionType.OUTFLOW;

      const inflowVal = parseFloat(inflowRaw) || 0;
      const outflowVal = parseFloat(outflowRaw) || 0;

      if (inflowVal > 0) {
        amount = inflowVal.toFixed(2);
        type = TransactionType.INFLOW;
      } else if (outflowVal > 0) {
        amount = outflowVal.toFixed(2);
        type = TransactionType.OUTFLOW;
      } else {
        continue;
      }

      let dedupHash: string | null = null;
      if (!externalRef) {
        const dedupRaw = `${txnDate.toISOString()}_${description}_${amount}_${type}`;
        dedupHash = crypto.createHash('sha256').update(dedupRaw).digest('hex');
      }

      parsed.push({
        txnDate,
        amount,
        type,
        description,
        externalRef,
        dedupHash,
      });
    }

    return Promise.resolve(parsed);
  }
}
