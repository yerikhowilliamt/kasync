import {
  BankParser,
  ParsedTransaction,
} from '../interfaces/bank-parser.interface';
import { parse } from 'csv-parse/sync';
import * as crypto from 'crypto';
import { TransactionType } from '@prisma/client';

export class BcaCsvParser implements BankParser {
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

      let description = record[1];
      if (record[2] && record[2].length > 0 && record[2] !== '0000') {
        description += ` - ${record[2]}`;
      }

      const rawAmount = record[3].replace(/,/g, '');
      const amount = parseFloat(rawAmount).toFixed(2);

      const typeStr = record[4].toUpperCase();
      const type =
        typeStr === 'CR' ? TransactionType.INFLOW : TransactionType.OUTFLOW;

      const dedupRaw = `${txnDate.toISOString()}_${description}_${amount}_${type}`;
      const dedupHash = crypto
        .createHash('sha256')
        .update(dedupRaw)
        .digest('hex');

      parsed.push({
        txnDate,
        amount,
        type,
        description,
        externalRef: null,
        dedupHash,
      });
    }

    return Promise.resolve(parsed);
  }
}
