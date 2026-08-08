import { TransactionType } from '@prisma/client';

export interface ParsedTransaction {
  txnDate: Date;
  amount: string; // decimal representation
  type: TransactionType;
  description: string;
  externalRef: string | null;
  dedupHash: string | null;
}

export interface BankParser {
  parse(fileBuffer: Buffer): Promise<ParsedTransaction[]>;
}
