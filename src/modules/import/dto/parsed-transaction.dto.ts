import {
  IsDecimal,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { TransactionType } from '@prisma/client';

export enum TransactionTypeEnum {
  INFLOW = 'INFLOW',
  OUTFLOW = 'OUTFLOW',
}

export class ParsedTransactionDto {
  @IsString()
  txnDate!: string;

  @IsDecimal()
  amount!: string;

  @IsEnum(TransactionTypeEnum)
  type!: TransactionType;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsString()
  @IsOptional()
  externalRef?: string;

  @IsString()
  @IsOptional()
  dedupHash?: string | null;
}
